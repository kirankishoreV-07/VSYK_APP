// ============================================================
// VSYK Chits — WhatsApp Template Helpers
// ============================================================
// Thin, business-meaningful wrappers over sendTemplateMessage.
//
// Proactive / business-initiated WhatsApp messages MUST use a
// pre-approved template (you cannot free-text a user outside the
// 24-hour session window). Each helper below maps VSYK data onto
// the ordered {{1}}, {{2}}, ... placeholders of its template and
// looks up the approved template ID from the environment.
//
// Until a template is approved and its ID is set in .env, the
// helper returns a structured "template not configured" error
// instead of throwing — callers get a consistent GupshupSendResult.
// ============================================================

import { sendTemplateMessage } from './gupshup';
import { normalizePhoneToGupshup } from './phoneUtils';
import type { GupshupSendResult } from './types';

/** Resolve an approved template ID from the environment, if present. */
function getTemplateId(envKey: string): string {
  return process.env[envKey] || '';
}

function missingTemplate(envKey: string): GupshupSendResult {
  console.warn(`[Templates] ${envKey} is not set — approve the template and add its ID to .env`);
  return {
    success: false,
    error: `No approved template configured (${envKey}). Set it in .env after WhatsApp approval.`,
  };
}

/**
 * Installment due reminder — sent only AFTER the admin has manually settled
 * the auction (auctions.final_due_amount is set). Shows the same numbers the
 * app itself shows: base installment, dividend (from payment_schedules —
 * persisted by the atomic apply_auction_settlement database function, and
 * the resulting amount due. Notification-only — no link/CTA. Members are
 * directed to pay from the app (App → OTP login → My Dues → Select
 * installment → Pay via Razorpay), never via a WhatsApp URL.
 * Template body concept:
 *   "Hello {{1}}, your {{2}} auction for Month {{3}} is settled. Installment
 *    ₹{{4}} less dividend ₹{{5}} = ₹{{6}} due by {{7}}. Please complete the
 *    payment in the VSYK Chits app."
 *
 * @param amounts  Rupee amounts as display strings WITHOUT the ₹ symbol,
 *                 e.g. "45,000" (the ₹ lives in the approved template text).
 */
export async function sendInstallmentDueReminder(
  phone: string,
  memberName: string,
  groupOrCycle: string,
  month: string,
  baseInstallment: string,
  dividend: string,
  finalDue: string,
  dueDate: string,
): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_INSTALLMENT_DUE');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_INSTALLMENT_DUE');

  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [
    memberName,
    groupOrCycle,
    month,
    baseInstallment,
    dividend,
    finalDue,
    dueDate,
  ]);
}

/**
 * Payment overdue reminder. Notification-only — no link/CTA.
 * Template body concept:
 *   "Hello {{1}}, your VSYK Chits installment of ₹{{2}} for {{3}} was due on
 *    {{4}} and is still unpaid. Open the VSYK Chits app, log in with OTP,
 *    and pay from My Dues."
 */
export async function sendPaymentOverdueReminder(
  phone: string,
  memberName: string,
  amount: string,
  groupOrCycle: string,
  dueDate: string,
): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_PAYMENT_OVERDUE');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_PAYMENT_OVERDUE');

  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [
    memberName,
    amount,
    groupOrCycle,
    dueDate,
  ]);
}

/**
 * Partial payment notice. Notification-only — no link/CTA.
 * Template body concept:
 *   "Hello {{1}}, we received ₹{{2}} towards your {{3}} installment.
 *    Remaining balance: ₹{{4}}. Open the VSYK Chits app, log in with OTP,
 *    and pay the balance from My Dues."
 */
export async function sendPartialPaymentNotice(
  phone: string,
  memberName: string,
  amountReceived: string,
  groupOrCycle: string,
  remaining: string,
): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_PARTIAL_PAYMENT');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_PARTIAL_PAYMENT');

  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [
    memberName,
    amountReceived,
    groupOrCycle,
    remaining,
  ]);
}

/**
 * Auction scheduled notice. Sent once, when an admin finishes configuring a
 * previously-unscheduled auction (min_bid/max_bid/scheduled_at set). Reuses
 * the exact fields the member app itself shows for an upcoming auction
 * (group name, month/cycle, chit value) — nothing computed here.
 * Notification-only — no link/CTA.
 * Template body concept:
 *   "Hello {{1}}, the auction for {{2}} (Month {{3}}) is scheduled on {{4}}
 *    at {{5}}. Chit value: ₹{{6}}. Check the VSYK Chits app for details."
 */
export async function sendAuctionScheduledNotice(
  phone: string,
  memberName: string,
  groupOrCycle: string,
  month: string,
  date: string,
  time: string,
  chitValue: string,
): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_AUCTION_SCHEDULED');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_AUCTION_SCHEDULED');

  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [
    memberName,
    groupOrCycle,
    month,
    date,
    time,
    chitValue,
  ]);
}

/**
 * Personal "starting soon" reminder — sent ONLY to members who explicitly
 * set a reminder for this specific auction (auction_reminders table), not
 * the whole group. Distinct from sendAuctionScheduledNotice (sent once,
 * to everyone, when the auction is first configured). Notification-only —
 * no link/CTA.
 * Template body concept:
 *   "Hello {{1}}, your reminder: the {{2}} auction (Month {{3}}) starts in
 *    about {{4}} minutes. Open the VSYK Chits app to place your bid."
 */
export async function sendAuctionReminderNotice(
  phone: string,
  memberName: string,
  groupOrCycle: string,
  month: string,
  minutesUntil: string,
): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_AUCTION_REMINDER');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_AUCTION_REMINDER');

  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [
    memberName,
    groupOrCycle,
    month,
    minutesUntil,
  ]);
}

/**
 * One-time password (authentication-category template).
 * Approved template `vsyk_app_login_code_v2` body:
 *   "{{1}} is your verification code."
 *
 * The OTP must be generated and validated server-side; this helper only
 * delivers it. Never log the OTP value.
 */
export async function sendOTP(phone: string, otp: string): Promise<GupshupSendResult> {
  const templateId = getTemplateId('GUPSHUP_TEMPLATE_OTP');
  if (!templateId) return missingTemplate('GUPSHUP_TEMPLATE_OTP');

  if (!/^\d{4,8}$/.test(otp)) {
    return { success: false, error: 'OTP must be 4–8 digits' };
  }

  // Authentication templates with a Copy-code button require the code TWICE:
  // params[0] fills the body {{1}}, params[1] fills the copy-code button.
  // (Matches Gupshup's own sample: template.params = ["123456","123456"].)
  return sendTemplateMessage(normalizePhoneToGupshup(phone), templateId, [otp, otp]);
}
