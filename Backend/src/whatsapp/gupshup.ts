// ============================================================
// Gupshup API Communication Service
// ============================================================
// Centralized layer for all outbound Gupshup API calls.
// All secrets stay server-side. No API keys in logs or responses.
//
// Gupshup API uses application/x-www-form-urlencoded format.
// Session messages: POST https://api.gupshup.io/wa/api/v1/msg
// Template messages: POST https://api.gupshup.io/wa/api/v1/template/msg
// ============================================================

import type {
  GupshupSendResult,
  GupshupMediaType,
  DeliveryStatusResult,
} from './types';

// ── Configuration (from environment) ──────────────────────────

const SESSION_API_URL = 'https://api.gupshup.io/wa/api/v1/msg';
const TEMPLATE_API_URL = 'https://api.gupshup.io/wa/api/v1/template/msg';
// Opt-in lives on the legacy /sm/api/v1 path — Gupshup never migrated it to /wa.
// Shape: POST /sm/api/v1/app/opt/in/{appName}  body: user=<phone>
// IMPORTANT: this legacy endpoint authenticates against the ACCOUNT-LEVEL
// portal API key (dashboard → profile → API key), NOT the app-scoped `sk_`
// key used for /wa messaging. With the sk_ key it returns "Portal User Not
// Found With APIKey" (HTTP 401). Set GUPSHUP_OPTIN_API_KEY to the portal key
// to enable programmatic opt-in; otherwise rely on inbound-message auto opt-in.
const OPT_IN_API_URL = 'https://api.gupshup.io/sm/api/v1/app/opt/in';

const REQUEST_TIMEOUT_MS = 10_000;

function getGupshupConfig() {
  const apiKey = process.env.GUPSHUP_API_KEY || '';
  const appName = process.env.GUPSHUP_APP_NAME || '';
  const appId = process.env.GUPSHUP_APP_ID || '';
  const sourcePhone = process.env.GUPSHUP_SOURCE_PHONE || '';
  return {
    apiKey,
    appName,
    appId,
    sourcePhone,
    isConfigured: !!(apiKey && appName && sourcePhone),
  };
}

// ── In-memory delivery-status store ───────────────────────────
// Gupshup does not expose a synchronous "get status of message X" REST
// endpoint on the self-serve tier — status transitions (sent → delivered
// → read / failed) arrive asynchronously on the webhook. We keep the most
// recent status per messageId here so checkDeliveryStatus() can answer.
//
// NOTE: this Map is process-local and ephemeral. For production
// durability, persist these transitions to Supabase from the webhook and
// query that instead. Kept lightweight here to avoid a schema change.
interface StoredStatus {
  status: DeliveryStatusResult['status'];
  code?: number;
  reason?: string;
  updatedAt: number;
}
const deliveryStatusStore = new Map<string, StoredStatus>();

/** Cap the store so a long-running process can't grow unbounded. */
const MAX_TRACKED_MESSAGES = 5_000;

/**
 * Record a delivery-status transition for a message. Called by the webhook
 * when Gupshup delivers a `message-event` callback.
 */
export function recordDeliveryStatus(
  messageId: string,
  status: DeliveryStatusResult['status'],
  code?: number,
  reason?: string,
): void {
  if (!messageId) return;

  if (deliveryStatusStore.size >= MAX_TRACKED_MESSAGES) {
    // Evict the oldest entry (insertion order is preserved by Map).
    const oldestKey = deliveryStatusStore.keys().next().value;
    if (oldestKey !== undefined) deliveryStatusStore.delete(oldestKey);
  }

  deliveryStatusStore.set(messageId, {
    status,
    code,
    reason,
    updatedAt: Date.now(),
  });
}

// ── Public Functions ──────────────────────────────────────────

/**
 * Check if Gupshup is configured with the required credentials.
 */
export function isGupshupConfigured(): boolean {
  return getGupshupConfig().isConfigured;
}

/**
 * Send a text message to a WhatsApp user within the 24-hour session window.
 *
 * @param destination - Recipient phone in E.164 format (e.g. "919876543210")
 * @param text - The message text to send
 */
export async function sendTextMessage(
  destination: string,
  text: string,
): Promise<GupshupSendResult> {
  const config = getGupshupConfig();
  if (!config.isConfigured) {
    console.warn('[Gupshup] Not configured — skipping sendTextMessage');
    return { success: false, error: 'Gupshup not configured' };
  }

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source: config.sourcePhone,
    destination,
    'src.name': config.appName,
    message: JSON.stringify({ type: 'text', text }),
  });

  return callGupshupApi(SESSION_API_URL, body, config.apiKey, 'sendTextMessage');
}

/**
 * Send a pre-approved template message (for proactive/business-initiated messages).
 *
 * @param destination - Recipient phone in E.164 format
 * @param templateId - The Gupshup template ID (UUID from dashboard)
 * @param params - Template variable values in order
 */
export async function sendTemplateMessage(
  destination: string,
  templateId: string,
  params: string[],
): Promise<GupshupSendResult> {
  const config = getGupshupConfig();
  if (!config.isConfigured) {
    console.warn('[Gupshup] Not configured — skipping sendTemplateMessage');
    return { success: false, error: 'Gupshup not configured' };
  }

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source: config.sourcePhone,
    destination,
    'src.name': config.appName,
    template: JSON.stringify({ id: templateId, params }),
  });

  return callGupshupApi(TEMPLATE_API_URL, body, config.apiKey, 'sendTemplateMessage');
}

/**
 * Send a media message (image, document, video, or audio) within the
 * 24-hour session window.
 *
 * @param destination - Recipient phone in E.164 format (e.g. "919876543210")
 * @param mediaUrl - Publicly reachable HTTPS URL of the media asset
 * @param mediaType - 'image' | 'file' | 'video' | 'audio'
 * @param caption - Optional caption (ignored for audio by WhatsApp)
 */
export async function sendMediaMessage(
  destination: string,
  mediaUrl: string,
  mediaType: GupshupMediaType,
  caption?: string,
): Promise<GupshupSendResult> {
  if (!mediaUrl || !/^https?:\/\//i.test(mediaUrl)) {
    return { success: false, error: 'mediaUrl must be a valid http(s) URL' };
  }

  const config = getGupshupConfig();
  if (!config.isConfigured) {
    console.warn('[Gupshup] Not configured — skipping sendMediaMessage');
    return { success: false, error: 'Gupshup not configured' };
  }

  // Gupshup message shapes differ per media type:
  //  image/video/audio → { type, url, caption }
  //  file (document)    → { type: 'file', url, filename, caption }
  const message: Record<string, unknown> = { type: mediaType, url: mediaUrl };
  if (caption && mediaType !== 'audio') message.caption = caption;
  if (mediaType === 'file') {
    // Derive a filename from the URL so WhatsApp shows a sensible label.
    const guessed = decodeURIComponent(mediaUrl.split('/').pop() || 'document');
    message.filename = guessed.split('?')[0] || 'document';
  }

  const body = new URLSearchParams({
    channel: 'whatsapp',
    source: config.sourcePhone,
    destination,
    'src.name': config.appName,
    message: JSON.stringify(message),
  });

  return callGupshupApi(SESSION_API_URL, body, config.apiKey, 'sendMediaMessage');
}

/**
 * Opt a user in to receive WhatsApp messages from this app. Gupshup
 * requires an explicit opt-in before the number can receive session
 * messages. Idempotent — opting in an already-opted-in user succeeds.
 *
 * @param phoneNumber - Recipient phone in E.164 format (e.g. "919876543210")
 */
export async function optInUser(phoneNumber: string): Promise<GupshupSendResult> {
  const config = getGupshupConfig();
  if (!config.isConfigured) {
    console.warn('[Gupshup] Not configured — skipping optInUser');
    return { success: false, error: 'Gupshup not configured' };
  }

  const digits = phoneNumber.replace(/\D/g, '');
  if (!digits) {
    return { success: false, error: 'Invalid phone number' };
  }

  // POST https://api.gupshup.io/sm/api/v1/app/opt/in/{appName}  body: user=<phone>
  // Use the account-level portal key if provided; fall back to the app key
  // (which will 401 — surfaced as a clear structured error to the caller).
  const optInKey = process.env.GUPSHUP_OPTIN_API_KEY || config.apiKey;
  const url = `${OPT_IN_API_URL}/${encodeURIComponent(config.appName)}`;
  const body = new URLSearchParams({ user: digits });

  return callGupshupApi(url, body, optInKey, 'optInUser');
}

/**
 * Look up the latest known delivery status of a previously-sent message.
 *
 * Gupshup delivers status transitions asynchronously to the webhook, so
 * this reads the most recent state recorded by recordDeliveryStatus().
 * If we have not (yet) received a callback for this messageId, `status`
 * is 'unknown' — that is expected immediately after sending.
 *
 * @param messageId - The messageId returned by a send* call
 */
export function checkDeliveryStatus(messageId: string): DeliveryStatusResult {
  if (!messageId) {
    return { success: false, messageId: '', error: 'messageId is required' };
  }

  const entry = deliveryStatusStore.get(messageId);
  if (!entry) {
    return { success: true, messageId, status: 'unknown' };
  }

  return {
    success: true,
    messageId,
    status: entry.status,
    code: entry.code,
    reason: entry.reason,
    updatedAt: entry.updatedAt,
  };
}

// ── Internal Helpers ──────────────────────────────────────────

/**
 * Execute a Gupshup API call with timeout, error handling, and safe logging.
 */
async function callGupshupApi(
  url: string,
  body: URLSearchParams,
  apiKey: string,
  operationName: string,
): Promise<GupshupSendResult> {
  // GUPSHUP_DRY_RUN short-circuits every outbound Gupshup call before any
  // network request is made — this is the single choke point ALL send*
  // functions above route through, so it is the one place a test/regression
  // run can be made fully incapable of reaching real customers, regardless
  // of which real template IDs are configured in .env. Set only by test
  // entrypoints (never by the live server), and never for production.
  if (process.env.GUPSHUP_DRY_RUN === 'true') {
    const fakeMessageId = `dryrun-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    console.log(`[Gupshup][DRY RUN] ${operationName} — no real request sent (msgId: ${fakeMessageId})`);
    return { success: true, messageId: fakeMessageId, statusCode: 202 };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        apikey: apiKey,
      },
      body: body.toString(),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const responseText = await response.text();
    let responseData: any;

    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    // Some Gupshup endpoints have historically returned HTTP 2xx with an
    // application-level error payload. Treat that as a failure too; otherwise
    // the OTP row says "sent" even though Gupshup rejected it.
    const responseStatus = String(responseData?.status || '').toLowerCase();
    const applicationError = responseStatus === 'error' || responseData?.error;
    if (!response.ok || applicationError) {
      console.error(
        `[Gupshup] ${operationName} HTTP ${response.status}:`,
        responseData?.message || responseData?.error || responseText.slice(0, 200),
      );
      return {
        success: false,
        error: responseData?.message || responseData?.error || `HTTP ${response.status}`,
        statusCode: response.status,
      };
    }

    // Gupshup returns 200 for accepted requests (async processing)
    const messageId = responseData?.messageId || responseData?.id || undefined;

    console.log(
      `[Gupshup] ${operationName} accepted`,
      messageId ? `(msgId: ${messageId})` : '',
    );

    return {
      success: true,
      messageId,
      statusCode: response.status,
    };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`[Gupshup] ${operationName} timed out after ${REQUEST_TIMEOUT_MS}ms`);
      return { success: false, error: 'Request timed out' };
    }

    console.error(`[Gupshup] ${operationName} exception:`, error.message);
    return { success: false, error: error.message };
  }
}
