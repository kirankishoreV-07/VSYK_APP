import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyGroupEnrolment, type SendOutcome } from '../whatsapp/proactiveNotifications';

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

async function getAuthedCustomerId(req: Request): Promise<string | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return (data.user.user_metadata as any)?.customer_id || null;
}

function notificationMessage(outcome: SendOutcome): string {
  if (outcome === 'sent') return 'You joined the group and the WhatsApp confirmation was sent.';
  if (outcome === 'duplicate') return 'You joined the group. The WhatsApp confirmation was already sent.';
  if (outcome === 'skipped_optout') return 'You joined the group. WhatsApp was not sent because notification consent is not active.';
  return 'You joined the group. WhatsApp could not be sent; please check the app for membership details.';
}

export const membershipsRouter = Router();

/** Member self-enrolment; customer identity always comes from the JWT. */
membershipsRouter.post('/join', async (req: Request, res: Response) => {
  const admin = getAdmin();
  if (!admin) return res.status(503).json({ error: 'Membership service is not configured.' });

  const customerId = await getAuthedCustomerId(req);
  if (!customerId) return res.status(401).json({ error: 'Authentication required.' });

  const groupId = typeof req.body?.groupId === 'string' ? req.body.groupId.trim() : '';
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return res.status(400).json({ error: 'Select a valid chit group.' });

  const { data: group, error: groupError } = await admin
    .from('chit_groups')
    .select('id, status')
    .eq('id', groupId)
    .maybeSingle();
  if (groupError) return res.status(500).json({ error: 'Could not validate the chit group.' });
  if (!group || group.status !== 'active') return res.status(409).json({ error: 'This chit group is not open for joining.' });

  const { data: member, error } = await admin
    .from('chit_members')
    .insert({
      chit_group_id: groupId,
      customer_id: customerId,
      participation_type: 'full',
      participation_share: 1,
    })
    .select('id')
    .single();

  if (error) {
    const lower = error.message.toLowerCase();
    if ((error as any).code === '23505') return res.status(409).json({ error: 'You already joined this chit group.' });
    if ((error as any).code === '23514' || lower.includes('capacity')) {
      return res.status(409).json({ error: 'This chit group is full.' });
    }
    console.error('[Membership] self-enrolment failed:', error.message);
    return res.status(500).json({ error: 'Could not join the chit group.' });
  }

  const notification = await notifyGroupEnrolment(member.id);
  return res.status(201).json({
    ok: true,
    memberId: member.id,
    notification,
    notificationMessage: notificationMessage(notification),
  });
});
