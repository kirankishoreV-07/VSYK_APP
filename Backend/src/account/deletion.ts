// ============================================================
// Account deletion request flow (Phase 6)
// ============================================================
// A member initiates deletion in-app; an admin reviews and processes it.
// Processing anonymizes PII on the customers row only — payment_schedules,
// chit_member_transactions, chit_members, auctions, and auction_bids are
// never touched, preserving the financial/audit trail. The member's phone
// is replaced with a unique non-resolvable placeholder (the column is
// NOT NULL UNIQUE) so OTP login can never find this row again, and their
// Supabase Auth user is deleted so no session can be restored.
// ============================================================

import { Router, Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../middleware/adminAuth';

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key);
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

export const accountRouter = Router();

/**
 * Member-initiated deletion request. Idempotent — re-requesting after an
 * already-pending request is a no-op, not an error.
 */
accountRouter.post('/delete-request', async (req: Request, res: Response) => {
  try {
    const admin = getAdmin();
    if (!admin) return res.status(500).json({ error: 'Not configured.' });

    const customerId = await getAuthedCustomerId(req);
    if (!customerId) return res.status(401).json({ error: 'Authentication required.' });

    const { data: existing } = await admin
      .from('customers')
      .select('deletion_requested_at, deletion_processed_at')
      .eq('id', customerId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Account not found.' });
    if ((existing as any).deletion_processed_at) {
      return res.status(409).json({ error: 'This account has already been deleted.' });
    }
    if ((existing as any).deletion_requested_at) {
      return res.json({ ok: true, alreadyRequested: true });
    }

    const { error: upErr } = await admin
      .from('customers')
      .update({ deletion_requested_at: new Date().toISOString() })
      .eq('id', customerId);
    if (upErr) return res.status(500).json({ error: 'Failed to record deletion request.' });

    return res.json({ ok: true, alreadyRequested: false });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to submit deletion request.' });
  }
});

/**
 * Admin-processed deletion — anonymizes PII, preserves financial/audit
 * rows, revokes the member's ability to ever log back in.
 */
accountRouter.post('/process-deletion', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = getAdmin();
    if (!admin) return res.status(500).json({ error: 'Not configured.' });

    const { customerId } = req.body ?? {};
    if (!customerId) return res.status(400).json({ error: 'customerId is required.' });

    const { data: customer, error: findErr } = await admin
      .from('customers')
      .select('id, auth_user_id, deletion_processed_at')
      .eq('id', customerId)
      .maybeSingle();
    if (findErr || !customer) return res.status(404).json({ error: 'Account not found.' });
    if ((customer as any).deletion_processed_at) {
      return res.status(409).json({ error: 'This account has already been deleted.' });
    }

    const placeholderPhone = `deleted-${customerId}`;
    const { error: anonErr } = await admin
      .from('customers')
      .update({
        full_name: 'Deleted User',
        phone: placeholderPhone,
        email: null,
        address_line1: null,
        address_line2: null,
        city: null,
        state: null,
        postal_code: null,
        aadhar_number: null,
        pan_number: null,
        notes: null,
        whatsapp_opt_in: false,
        whatsapp_opt_out_at: new Date().toISOString(),
        deletion_processed_at: new Date().toISOString(),
      })
      .eq('id', customerId);
    if (anonErr) return res.status(500).json({ error: `Failed to anonymize account: ${anonErr.message}` });

    // Revoke login ability entirely — deleting the auth user means no
    // OTP-issued session can ever be restored for this identity again.
    const authUserId = (customer as any).auth_user_id;
    if (authUserId) {
      await admin.auth.admin.deleteUser(authUserId).catch(() => {});
    }

    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to process deletion.' });
  }
});
