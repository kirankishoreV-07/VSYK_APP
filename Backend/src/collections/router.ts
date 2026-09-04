// ============================================================
// Collections Follow-up admin routes
// ============================================================
// All routes are admin-only (requireAdminAuth — same middleware every other
// admin/scheduler route in server.ts uses). This is deliberately a thin
// layer: generation logic lives in service.ts, and the actual "payment
// received" write path is untouched — see 041_collections_followups.sql for
// why 'collected' here never flips payment_schedules.paid directly.
// ============================================================

import { Router, Request, Response } from 'express';
import { requireAdminAuth } from '../middleware/adminAuth';
import { generateAndNotifyToday } from './service';
import { notifyStaffDailyDigest } from '../whatsapp/proactiveNotifications';

// Reading/updating individual follow-up rows (status, assignment, notes) is
// deliberately NOT a backend route — collection_followups RLS already grants
// the authenticated admin full read/write (same is_admin() pattern as every
// other admin-managed table), so the Frontend writes those directly via
// supabase-js, exactly like RecordCashCollectionModal.tsx and the rest of
// the admin app already do. Only generation (cross-table + service-role) and
// digest-sending (Gupshup) genuinely need to run on the backend.

export const collectionsRouter = Router();

/** Generate (idempotent) today's follow-up list and send staff their digest. */
collectionsRouter.post('/followups/generate', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await generateAndNotifyToday();
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[Collections] generate failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to generate follow-ups.' });
  }
});

/** Manual re-send of the staff digest — for after the admin reassigns tasks. */
collectionsRouter.post('/followups/resend-digest', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const tally = await notifyStaffDailyDigest();
    return res.json({ ok: true, ...tally });
  } catch (error: any) {
    console.error('[Collections] resend digest failed:', error?.message || error);
    return res.status(500).json({ error: 'Failed to resend digest.' });
  }
});
