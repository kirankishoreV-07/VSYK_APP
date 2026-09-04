// ============================================================
// WhatsApp Router — Express Route Registration
// ============================================================
// Mounts the WhatsApp webhook endpoint under /api/whatsapp/.
// Imported and mounted in server.ts with a single app.use() call.
// ============================================================

import { Router, Request, Response } from 'express';
import { getPersistedDeliveryStatus, handleWebhook } from './webhook';
import { checkDeliveryStatus } from './gupshup';
import { requireAdminAuth } from '../middleware/adminAuth';

export const whatsappRouter = Router();

// POST /api/whatsapp/webhook — Gupshup inbound webhook
whatsappRouter.post('/webhook', handleWebhook);

// GET /api/whatsapp/status/:messageId — delivery status for a sent message.
// Reads the in-memory store filled by delivery-status webhook callbacks.
// Was previously public with no auth at all — message ids are otherwise
// unguessable, but this closes off using it to probe/enumerate them.
// Admin-only (diagnostics use case), same auth as the other admin routes.
whatsappRouter.get('/status/:messageId', requireAdminAuth, async (req: Request, res: Response) => {
  const messageId = String(req.params.messageId);
  const persisted = await getPersistedDeliveryStatus(messageId);
  res.json(persisted || checkDeliveryStatus(messageId));
});
