// ============================================================
// WhatsApp Webhook Handler
// ============================================================
// Handles inbound HTTP POST from Gupshup.
// Parses the Gupshup v2 payload, deduplicates messages using
// the existing notification_log table, routes text messages
// to the chatbot, and sends the response via Gupshup.
// ============================================================

import { Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import type {
  GupshupWebhookEvent,
  GupshupMessagePayload,
  ParsedInboundMessage,
} from './types';
import { normalizePhoneToDb } from './phoneUtils';
import { normalizePhoneToGupshup } from './phoneUtils';
import { handleMessage } from './chatbot';
import { sendTextMessage, recordDeliveryStatus } from './gupshup';

function maskPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits ? `...${digits.slice(-4)}` : 'unknown';
}

// ── Supabase client for idempotency checks ────────────────────

let _supabase: ReturnType<typeof createClient> | null = null;

function getSupabase() {
  if (_supabase) return _supabase;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!url || !key) return null;
  _supabase = createClient(url, key);
  return _supabase;
}

// ── Webhook Handler ───────────────────────────────────────────

/**
 * Express handler for POST /api/whatsapp/webhook
 *
 * Responds 200 immediately to Gupshup, then processes the
 * message asynchronously.
 */
export async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Gupshup does not sign webhook payloads (no HMAC scheme available on this
  // tier) — the only real verification available is a shared secret, sent
  // as a custom header via Gupshup's dashboard "Includes headers" webhook
  // option (Gupshup rejects query strings in the callback URL itself, so
  // that approach isn't viable here). Previously the only check was an
  // app-name string compare, which is not a secret (it appears in every
  // legitimate payload too) and provided no real protection. Always 200 on
  // mismatch (never reveal via status code) — matches the existing
  // ignored-event pattern below.
  const expectedToken = process.env.GUPSHUP_WEBHOOK_TOKEN || '';
  if (!expectedToken) {
    console.error('[Webhook] Rejected — GUPSHUP_WEBHOOK_TOKEN is not configured');
    res.status(503).json({ status: 'unavailable', reason: 'webhook verification not configured' });
    return;
  }
  if (req.headers?.['x-webhook-token'] !== expectedToken) {
    console.warn('[Webhook] Rejected — missing/incorrect webhook token');
    res.status(200).json({ status: 'ignored', reason: 'unauthorized' });
    return;
  }

  // Always respond quickly to Gupshup
  const body = req.body;

  // Basic payload validation
  if (!body || !body.type) {
    console.warn('[Webhook] Invalid payload — missing type field');
    res.status(200).json({ status: 'ignored', reason: 'invalid payload' });
    return;
  }

  // Validate app name if configured (security check)
  const expectedApp = process.env.GUPSHUP_APP_NAME;
  if (expectedApp && body.app && body.app !== expectedApp) {
    console.warn(`[Webhook] App mismatch: expected "${expectedApp}", got "${body.app}"`);
    res.status(200).json({ status: 'ignored', reason: 'app mismatch' });
    return;
  }

  const event = body as GupshupWebhookEvent;

  // Route by event type
  switch (event.type) {
    case 'message':
      // Respond immediately, process async
      res.status(200).json({ status: 'received' });
      processInboundMessage(event).catch((err) =>
        console.error('[Webhook] Async processing error:', err.message),
      );
      return;

    case 'message-event':
      // Delivery status — log and acknowledge
      handleDeliveryStatus(event).catch((err) =>
        console.error('[Webhook] Delivery status persistence error:', err.message),
      );
      res.status(200).json({ status: 'ack' });
      return;

    default:
      console.log(`[Webhook] Unsupported event type: ${event.type}`);
      res.status(200).json({ status: 'ignored', reason: 'unsupported type' });
      return;
  }
}

// ── Inbound Message Processing ────────────────────────────────

async function processInboundMessage(event: GupshupWebhookEvent): Promise<void> {
  const payload = event.payload as GupshupMessagePayload;

  // Parse the message
  const parsed = parseMessage(payload, event.timestamp);
  if (!parsed) {
    console.warn('[Webhook] Could not parse inbound message payload');
    return;
  }

  console.log(
    `[Webhook] Inbound ${parsed.messageType} from ${maskPhone(parsed.phoneDb)}`,
    `(msgId: ${parsed.messageId.slice(0, 12)}...)`,
  );

  // Idempotency check — skip if already processed
  const alreadyProcessed = await checkIdempotency(parsed.messageId);
  if (alreadyProcessed) {
    console.log(`[Webhook] Duplicate message ${parsed.messageId.slice(0, 12)}... — skipping`);
    return;
  }

  // Route every inbound message through the chatbot authorization gate. For
  // unsupported message types, parsed.text is empty, so unauthorized senders
  // still receive only the generic unregistered response.
  const responseText = await handleMessage(parsed.phone, parsed.text);

  // Send the response via Gupshup
  const gupshupPhone = normalizePhoneToGupshup(parsed.phoneDb);
  const result = await sendTextMessage(gupshupPhone, responseText);

  if (!result.success) {
    console.error(
      `[Webhook] Failed to send response to ${maskPhone(parsed.phoneDb)}:`,
      result.error,
    );
  }
}

// ── Message Parser ────────────────────────────────────────────

function parseMessage(
  payload: GupshupMessagePayload,
  timestamp: number,
): ParsedInboundMessage | null {
  if (!payload || !payload.source || !payload.id) {
    return null;
  }

  let text = '';

  // Extract text based on message type
  switch (payload.type) {
    case 'text':
      text = payload.payload?.text || '';
      break;
    case 'button_reply':
    case 'list_reply':
      // For interactive replies, use the title or id
      text = payload.payload?.title || payload.payload?.id || '';
      break;
    default:
      // For other types (image, video, etc.), set empty text
      text = '';
      break;
  }

  return {
    messageId: payload.id,
    phone: payload.source,
    phoneDb: normalizePhoneToDb(payload.source),
    messageType: payload.type || 'unknown',
    text,
    senderName: payload.sender?.name || '',
    timestamp,
  };
}

// ── Idempotency Check ─────────────────────────────────────────

/**
 * Check if a message has already been processed using the
 * existing notification_log table.
 *
 * Returns true if the message was already processed (duplicate).
 * Returns false if this is a new message (claim succeeded).
 */
async function checkIdempotency(messageId: string): Promise<boolean> {
  const supabase = getSupabase();
  if (!supabase) {
    // If DB is unavailable, process anyway (best effort)
    return false;
  }

  const { error } = await supabase
    .from('notification_log')
    .insert({
      notification_key: `wa_inbound:${messageId}`,
      notification_type: 'whatsapp_inbound',
    } as any);

  if (error) {
    // 23505 = unique_violation → already processed
    if ((error as any).code === '23505') {
      return true;
    }
    // Other errors — log but don't block processing
    console.warn('[Webhook] Idempotency check error:', error.message);
    return false;
  }

  return false; // New message — proceed
}

// ── Delivery Status Handler ───────────────────────────────────

async function handleDeliveryStatus(event: GupshupWebhookEvent): Promise<void> {
  const payload = event.payload as any;
  const status = payload?.type || 'unknown';
  const destination = payload?.destination || 'unknown';
  const code = payload?.payload?.code || payload?.code || '';
  const reason = payload?.payload?.reason || payload?.reason || '';

  // Record the transition so checkDeliveryStatus() can report it later.
  // For delivery reports, `gsId` is the Gupshup message ID returned by the
  // send API; `id` may instead be WhatsApp's message ID. OTP requests store
  // the former, so key delivery state by gsId when it is present.
  const trackingId = payload?.gsId || payload?.id;
  if (trackingId) {
    recordDeliveryStatus(
      trackingId,
      status,
      code ? Number(code) : undefined,
      reason || undefined,
    );

    const supabase = getSupabase();
    if (supabase) {
      const { error } = await supabase.from('whatsapp_delivery_events').upsert({
        message_id: String(trackingId),
        status: String(status),
        code: code ? Number(code) : null,
        reason: reason ? String(reason).slice(0, 500) : null,
        destination_last4: String(destination).replace(/\D/g, '').slice(-4) || null,
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'message_id' });
      if (error) throw error;
    }
  }

  // Log delivery status for monitoring with exact error code & reason
  console.log(
    `[Webhook] Delivery status: ${status}`,
    `for ${maskPhone(destination)}`,
    code ? `| Code: ${code}` : '',
    reason ? `| Reason: "${reason}"` : '',
    payload?.gsId ? `(gsId: ${payload.gsId.slice(0, 8)}...)` : '',
  );

  if (status === 'failed') {
    console.error(
      '[Webhook] Delivery failed',
      trackingId ? `(msgId: ${String(trackingId).slice(0, 12)}...)` : '',
      code ? `code=${code}` : '',
      reason ? `reason="${reason}"` : '',
      `destination=${maskPhone(destination)}`,
    );
  }
}

export async function getPersistedDeliveryStatus(messageId: string) {
  const supabase = getSupabase();
  if (!supabase || !messageId) return null;
  const { data, error } = await supabase
    .from('whatsapp_delivery_events')
    .select('message_id, status, code, reason, updated_at')
    .eq('message_id', messageId)
    .maybeSingle();
  if (error) {
    console.warn('[Webhook] Could not load persisted delivery status:', error.message);
    return null;
  }
  return data;
}
