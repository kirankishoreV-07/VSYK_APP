import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { requireAdminAuth } from '../middleware/adminAuth';

export const auctionHistoryRouter = Router();

// auction_events intentionally has no direct client RLS access. Read it only
// after validating the admin's Supabase session; this endpoint writes nothing.
auctionHistoryRouter.post('/auctions/:id/history-events', requireAdminAuth, async (req: Request, res: Response) => {
  const id = String(req.params.id || '');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return res.status(400).json({ error: 'A valid auction ID is required.' });
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return res.status(503).json({ error: 'Auction history is not configured.' });
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const events: any[] = [];
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await admin.from('auction_events')
        .select('id, event_type, performed_by, notes, created_at').eq('auction_id', id)
        .order('created_at', { ascending: true }).order('id', { ascending: true })
        .range(offset, offset + 499);
      if (error) throw error;
      events.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    return res.json({ events });
  } catch {
    return res.status(500).json({ error: 'Could not load the auction event history.' });
  }
});
