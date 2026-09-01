// ============================================================
// VSYK WhatsApp Chatbot — Conversation Logic
// ============================================================
// Stateless chatbot that routes user messages to the correct
// handler and returns a response string. All financial data
// comes from service.ts (Supabase). No data is hard-coded.
//
// Phase 1 uses simple text matching. No session/state tracking.
// ============================================================

import type { VsykCustomer } from './types';
import {
  findAuthorizedWhatsAppCustomer,
  getCustomerChits,
  getOutstandingDues,
  updateWhatsAppConsentByPhone,
  formatRupees,
  formatDate,
} from './service';
import { normalizePhoneToDb } from './phoneUtils';

// ── Main Entry Point ──────────────────────────────────────────

/**
 * Handle an incoming message and return the response text.
 *
 * @param sourcePhone - Raw phone from Gupshup (E.164, e.g. "919876543210")
 * @param messageText - The user's message content
 * @returns The response text to send back via Gupshup
 */
export async function handleMessage(
  sourcePhone: string,
  messageText: string,
): Promise<string> {
  // Normalize phone to DB format
  const phone10 = normalizePhoneToDb(sourcePhone);
  const input = messageText.trim();

  if (isOptOutCommand(input)) {
    await updateWhatsAppConsentByPhone(phone10, false);
    return RESPONSES.optedOut;
  }

  if (isOptInCommand(input)) {
    const status = await updateWhatsAppConsentByPhone(phone10, true);
    if (status !== 'found') {
      return RESPONSES.unknownCustomer;
    }
    return RESPONSES.optedIn;
  }

  let customer: VsykCustomer | null = null;
  try {
    const lookup = await findAuthorizedWhatsAppCustomer(phone10);
    if (lookup.status === 'temporary_error') {
      return RESPONSES.temporaryError;
    }
    if (lookup.status === 'opted_out') {
      return RESPONSES.alreadyOptedOut;
    }
    if (lookup.status !== 'found' || !lookup.customer) {
      return RESPONSES.unknownCustomer;
    }
    customer = lookup.customer;
  } catch (err: any) {
    console.error('[Chatbot] Customer lookup failed:', err.message);
    return RESPONSES.temporaryError;
  }

  // Parse the message and route to the correct handler
  const firstName = customer.full_name.split(' ')[0] || customer.full_name;

  // Check for greeting or menu request
  if (isGreeting(input) || input.toLowerCase() === 'menu') {
    return buildMainMenu(firstName);
  }

  // Route numbered options
  switch (input) {
    case '1':
      return handleChitDetails(customer);   // live data
    case '2':
      return handlePaymentDue(customer);    // live data
    case '3':
      return handlePaymentHistory();        // navigate to app (no data)
    case '4':
      return handleReceipt();               // navigate to app
    case '5':
      return handleSupport(firstName);      // static
    default:
      return buildUnrecognizedMessage(firstName);
  }
}

// ── Response Constants ────────────────────────────────────────

const RESPONSES = {
  unknownCustomer:
    `This WhatsApp number is not registered with VSYK Chits.`,

  temporaryError:
    `We're experiencing temporary issues. Please try again in a few minutes.\n\n` +
    `If the problem persists, please contact VSYK support.`,

  optedOut:
    `You have been opted out of VSYK Chits WhatsApp messages. Reply START to opt in again.`,

  optedIn:
    `You have opted in to VSYK Chits WhatsApp messages. Reply Hi to see the menu.`,

  alreadyOptedOut:
    `This WhatsApp number has opted out of VSYK Chits WhatsApp messages. Reply START to opt in again.`,

  noActiveChits:
    `You don't have any active chit memberships currently.\n\n` +
    `Please contact your admin to get enrolled in a chit group.`,

  noPaymentsDue:
    `✅ Great news! You have no pending payments.\n\n` +
    `All your installments are up to date. Keep it up! 🎉`,

  noPaymentHistory:
    `No payment records found yet.\n\n` +
    `Your payment history will appear here once you make your first installment.`,
};

// ── Greeting Detection ────────────────────────────────────────

const GREETING_PATTERNS = [
  /^h(i|ello|ey|ola)/i,
  /^(good\s*(morning|afternoon|evening|day))/i,
  /^(namaste|vanakkam|namaskar)/i,
  /^(start|begin|help)/i,
  /^(menu|options)/i,
  /^(hai|hii+)/i,
];

function isGreeting(text: string): boolean {
  const cleaned = text.trim().toLowerCase();
  return GREETING_PATTERNS.some((pattern) => pattern.test(cleaned));
}

function isOptOutCommand(text: string): boolean {
  return /^(stop|unsubscribe|opt\s*out|cancel)$/i.test(text.trim());
}

function isOptInCommand(text: string): boolean {
  return /^(start|subscribe|opt\s*in)$/i.test(text.trim());
}

// ── Menu Builder ──────────────────────────────────────────────

function buildMainMenu(firstName: string): string {
  return (
    `👋 Welcome to VSYK Chits, ${firstName}!\n\n` +
    `How can we help you?\n\n` +
    `1️⃣ My Chit Details\n` +
    `2️⃣ Payment Due\n` +
    `3️⃣ Payment History\n` +
    `4️⃣ Download Receipt\n` +
    `5️⃣ Contact Support\n\n` +
    `Reply with a number (1-5)`
  );
}

function buildUnrecognizedMessage(firstName: string): string {
  return (
    `Sorry ${firstName}, I didn't understand that.\n\n` +
    `Please reply with a number (1-6) to select an option, ` +
    `or say "Hi" to see the main menu.`
  );
}

// ── Option 1: Chit Details ────────────────────────────────────

async function handleChitDetails(customer: VsykCustomer): Promise<string> {
  try {
    const chits = await getCustomerChits(customer.id);

    if (chits.length === 0) {
      return RESPONSES.noActiveChits;
    }

    let response = `📋 *Your Chit Details*\n\n`;

    for (let i = 0; i < chits.length; i++) {
      const c = chits[i];
      response +=
        `${i + 1}. *${c.groupName}*\n` +
        `   💰 Value: ${formatRupees(c.groupValue)}\n` +
        `   📅 Duration: ${c.durationMonths} months\n` +
        `   💵 Monthly: ${formatRupees(c.monthlyInstallment)}\n` +
        (c.ticketNumber ? `   🎫 Ticket: #${c.ticketNumber}\n` : '') +
        `   📊 Status: ${c.groupStatus}\n\n`;
    }

    response += `Reply "2" to check payment dues or "Hi" for menu.`;
    return response;
  } catch (err: any) {
    console.error('[Chatbot] Chit details error:', err.message);
    return RESPONSES.temporaryError;
  }
}

// ── Option 2: Payment Due ─────────────────────────────────────

async function handlePaymentDue(customer: VsykCustomer): Promise<string> {
  try {
    // Only dues for COMPLETED auctions that are still unpaid (finalized amount).
    const dues = await getOutstandingDues(customer.id);

    if (dues.length === 0) {
      return RESPONSES.noPaymentsDue;
    }

    const totalDue = dues.reduce((sum, d) => sum + d.amount, 0);
    const MAX_SHOWN = 20; // ordered by due date; bounded by completed auctions, guards 4096-char cap
    const shown = dues.slice(0, MAX_SHOWN);
    const remaining = dues.length - shown.length;

    let response = `💳 *Amount Due*\n\nYour outstanding installment${dues.length > 1 ? 's' : ''}:\n\n`;

    shown.forEach((d, i) => {
      response +=
        `${i + 1}. *${d.groupName}* — Month ${d.monthNumber}\n` +
        `   Due Amount: ${formatRupees(d.amount)}\n` +
        `   Due Date: ${formatDate(d.dueDate)}\n\n`;
    });

    if (remaining > 0) {
      response += `…and ${remaining} more. Open the app to see all.\n\n`;
    }

    response +=
      `*Total Outstanding: ${formatRupees(totalDue)}*\n\n` +
      `To pay, open the *VSYK Chits app*. Reply "Hi" for menu.`;

    return response;
  } catch (err: any) {
    console.error('[Chatbot] Payment due error:', err.message);
    return RESPONSES.temporaryError;
  }
}

// ── Option 3: Payment History (navigate to app — no data shown) ───

function handlePaymentHistory(): string {
  return (
    `📜 *Payment History*\n\n` +
    `To view your full payment history:\n\n` +
    `📱 Open the *VSYK Chits app*\n` +
    `→ Go to the *Chits* tab\n` +
    `→ Select your group\n` +
    `→ View payment details\n\n` +
    `Reply "Hi" for menu.`
  );
}

// ── Option 4: Receipt (navigate to app) ───────────────────────

function handleReceipt(): string {
  return (
    `🧾 *Download Receipt*\n\n` +
    `To view and download your payment receipts:\n\n` +
    `📱 Open the *VSYK Chits app*\n` +
    `→ Go to the *Chits* tab\n` +
    `→ Select your group\n` +
    `→ View payment details\n\n` +
    `For older receipts or specific documents, please contact VSYK support.\n\n` +
    `Reply "Hi" for menu.`
  );
}

// ── Option 5: Support ─────────────────────────────────────────

function handleSupport(firstName: string): string {
  return (
    `📞 *Contact Support*\n\n` +
    `Hello ${firstName}, we're here to help!\n\n` +
    `🏢 *VSYK Chits Pvt Ltd*\n\n` +
    `For account queries, payment issues, or general help:\n` +
    `• Reply to this chat with your question\n` +
    `• Our team will respond during business hours\n\n` +
    `⏰ Business Hours: Mon-Sat, 9:00 AM - 6:00 PM\n\n` +
    `Reply "Hi" for menu.`
  );
}
