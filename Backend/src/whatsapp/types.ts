// ============================================================
// Gupshup WhatsApp — TypeScript Interfaces
// ============================================================
// Defines the expected payload shapes for Gupshup v2 webhooks
// and outbound API responses.
// ============================================================

// ── Inbound Webhook Payloads ──────────────────────────────────

/** Top-level Gupshup webhook event (v2). */
export interface GupshupWebhookEvent {
  app: string;
  timestamp: number;
  version: number;
  type: 'message' | 'message-event' | string;
  payload: GupshupMessagePayload | GupshupMessageEventPayload;
}

/** Inbound message payload (type === 'message'). */
export interface GupshupMessagePayload {
  id: string;
  source: string;       // E.164 phone, e.g. "919876543210"
  type: 'text' | 'image' | 'file' | 'audio' | 'video' | 'contact' | 'location' | 'button_reply' | 'list_reply' | string;
  payload: GupshupMessageContent;
  sender: GupshupSender;
  context?: GupshupContext;
}

/** The inner content of an inbound message (nested payload). */
export interface GupshupMessageContent {
  text?: string;          // For type === 'text'
  id?: string;            // For button_reply / list_reply
  title?: string;         // For button_reply / list_reply
  url?: string;           // For media types
  caption?: string;       // For media types
  // Add more fields as needed for other message types
}

/** Sender information on an inbound message. */
export interface GupshupSender {
  phone: string;
  name: string;
  country_code?: string;
  dial_code?: string;
}

/** Context/reference IDs for message threading. */
export interface GupshupContext {
  id?: string;
  gsId?: string;
}

/** Delivery status event payload (type === 'message-event'). */
export interface GupshupMessageEventPayload {
  id: string;
  gsId?: string;
  type: 'enqueued' | 'failed' | 'sent' | 'delivered' | 'read' | string;
  destination: string;
  payload?: {
    ts?: number;
    code?: number;
    reason?: string;
  };
}

// ── Outbound API Response ─────────────────────────────────────

/** Result from a Gupshup outbound API call. */
export interface GupshupSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  statusCode?: number;
}

/** Supported media types for outbound media messages. */
export type GupshupMediaType = 'image' | 'file' | 'video' | 'audio';

/**
 * Delivery status for a previously-sent message.
 * Gupshup pushes status transitions to the webhook asynchronously;
 * `checkDeliveryStatus` reads the latest known state from the in-memory
 * store populated by the webhook (see gupshup.ts::recordDeliveryStatus).
 */
export interface DeliveryStatusResult {
  success: boolean;
  messageId: string;
  status?: 'enqueued' | 'sent' | 'delivered' | 'read' | 'failed' | 'unknown';
  code?: number;
  reason?: string;
  updatedAt?: number;
  error?: string;
}

// ── Internal Types ────────────────────────────────────────────

/** Parsed inbound message after webhook processing. */
export interface ParsedInboundMessage {
  messageId: string;
  phone: string;          // Raw E.164 from Gupshup (e.g. "919876543210")
  phoneDb: string;        // Normalized to DB format (e.g. "9876543210")
  messageType: string;    // 'text', 'button_reply', etc.
  text: string;           // Extracted text content
  senderName: string;
  timestamp: number;
}

/** Customer record from Supabase (subset of customers table). */
export interface VsykCustomer {
  id: string;             // UUID
  customer_id: string;    // e.g. "VS-1001"
  full_name: string;
  phone: string;          // 10-digit
  whatsapp_opt_in?: boolean | null;
  whatsapp_opt_in_at?: string | null;
  whatsapp_opt_out_at?: string | null;
}

export type WhatsAppCustomerLookupStatus =
  | 'found'
  | 'invalid_phone'
  | 'not_found'
  | 'ambiguous'
  | 'inactive'
  | 'opted_out'
  | 'temporary_error';

export interface WhatsAppCustomerLookupResult {
  status: WhatsAppCustomerLookupStatus;
  customer: VsykCustomer | null;
}

/** Chit membership with group info. */
export interface CustomerChitMembership {
  memberId: string;
  ticketNumber: number | null;
  participationShare: number;
  groupName: string;
  groupValue: number;       // paise
  durationMonths: number;
  monthlyInstallment: number; // paise
  groupStatus: string;
}

/** Unpaid installment with group info. */
export interface PendingInstallment {
  scheduleId: string;
  chitMemberId: string;
  monthNumber: number;
  dueDate: string;
  amount: number;           // paise
  dividendAmount: number;   // paise
  groupName: string;
}

/** Paid installment for history. */
export interface PaidInstallment {
  monthNumber: number;
  amount: number;           // paise
  paidAt: string;
  dividendAmount: number;   // paise
  groupName: string;
}
