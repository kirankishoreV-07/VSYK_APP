// ============================================================
// Proactive WhatsApp notifications (Phase 4)
// ============================================================
// The ONLY proactive messages we send:
//   A. Installment Due  — after an auction completes & the schedule is
//                         finalized, to members with a remaining balance.
//   B. Payment Overdue  — ONE reminder ~7 days after the due date.
//   C. Partial Payment  — after a verified partial payment.
//
// NOT sent: dividend, auction-won, auction-start, generic payment success.
//
// Every send is:
//   • gated on consent (never message a member who sent STOP),
//   • deduped via notification_log (customer/type/schedule/payment key) so a
//     scheduler restart / retry / duplicate trigger cannot double-send,
//   • retry-safe — a FAILED send releases its dedup claim so it can be retried;
//     a SUCCESSFUL send keeps the claim so it is never resent.
//
// Until a template is approved and its id set in .env, the template helper
// returns "not configured" (a failure) → the claim is released and nothing is
// sent, so this is safe to run before the Gupshup templates exist.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  sendInstallmentDueReminder,
  sendPaymentOverdueReminder,
  sendPartialPaymentNotice,
  sendAuctionScheduledNotice,
  sendAuctionReminderNotice,
} from './templates';
import { sendTextMessage } from './gupshup';
import { normalizePhoneToGupshup } from './phoneUtils';
import type { GupshupSendResult } from './types';

let _sb: SupabaseClient | null = null;
function getSb(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

/** Rupees display WITHOUT the ₹ symbol (the ₹ lives in the approved template). */
function rupeesPlain(paise: number): string {
  return Math.round(Number(paise || 0) / 100).toLocaleString('en-IN');
}

function shortDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

type SendOutcome = 'sent' | 'duplicate' | 'skipped_optout' | 'skipped_nobalance' | 'skipped_nomember' | 'skipped_inactive' | 'failed';

// Same "active member" definition used to gate chatbot access
// (Backend/src/whatsapp/service.ts hasActiveMembership) — reused here so a
// member removed from a group mid-cycle (bid_status flips away from these)
// stops receiving proactive notifications even if a stale payment_schedules
// row is still unpaid.
const ACTIVE_BID_STATUSES = ['active', 'bidding'];

/**
 * Run `fn` over `items` with at most `limit` in flight at once. A backlog of
 * hundreds of overdue schedules (e.g. after a scheduler outage) must not be
 * sent one-at-a-time — that risks blowing the scheduler's tick budget — but
 * unbounded parallelism would hammer Supabase/Gupshup. This caps concurrency
 * while still processing everything in one pass.
 */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Claim a notification key (idempotency) then send. On failure the claim is
 * released so a later tick can retry; on success it is kept (send-once).
 */
async function claimAndSend(
  sb: SupabaseClient,
  key: string,
  type: string,
  send: () => Promise<GupshupSendResult>,
): Promise<SendOutcome> {
  const { error: claimErr } = await sb
    .from('notification_log')
    .insert({ notification_key: key, notification_type: type });

  if (claimErr) {
    if ((claimErr as any).code === '23505') return 'duplicate'; // already sent/claimed
    console.warn('[Proactive] claim failed:', claimErr.message);
    return 'failed';
  }

  let result: GupshupSendResult;
  try {
    result = await send();
  } catch (e: any) {
    result = { success: false, error: e?.message || 'send threw' };
  }

  if (!result.success) {
    // Release the claim so this notification can be retried later.
    await sb.from('notification_log').delete().eq('notification_key', key);
    return 'failed';
  }

  // Record the Gupshup message id for delivery tracking (Phase 5).
  if (result.messageId) {
    await sb.from('notification_log').update({ sent_count: 1 }).eq('notification_key', key);
  }
  return 'sent';
}

// Shape of a schedule joined with member/customer/group used by A & B.
interface DueRow {
  id: string;
  chit_member_id: string;
  month_number: number;
  due_date: string;
  amount: number;
  paid_amount: number;
  dividendAmount: number;
  memberName: string;
  phone: string;
  lacksConsent: boolean;
  inactive: boolean;
  groupName: string;
}

function mapDueRow(row: any): DueRow {
  const cust = row.chit_members?.customers;
  return {
    id: row.id,
    chit_member_id: row.chit_member_id,
    month_number: row.month_number,
    due_date: row.due_date,
    amount: Number(row.amount || 0),
    paid_amount: Number(row.paid_amount || 0),
    dividendAmount: Number(row.dividend_amount || 0),
    memberName: (cust?.full_name || 'Member').split(' ')[0],
    phone: cust?.phone || '',
    lacksConsent: cust?.whatsapp_opt_in !== true,
    inactive: !ACTIVE_BID_STATUSES.includes(row.chit_members?.bid_status),
    groupName: row.chit_members?.chit_groups?.name || 'your chit group',
  };
}

const DUE_SELECT = `
  id, chit_member_id, month_number, due_date, amount, paid_amount, dividend_amount,
  chit_members ( bid_status, chit_groups ( name ), customers ( full_name, phone, whatsapp_opt_in, whatsapp_opt_out_at ) )
`;

// A claim (notification_log insert) is made BEFORE send() is attempted, and
// released (deleted) only if send() completes and reports failure. If the
// process itself crashes/is killed in between — no way to run that
// release — the claim is permanently stuck at sent_count=0 with no message
// ever sent, silently blocking that notification forever. A healthy claim
// always resolves (delete or sent_count=1 update) within seconds, so any
// sent_count=0 claim older than this is presumed orphaned and safe to clear
// for retry on the next tick.
const STALE_CLAIM_MINUTES = 5;

/**
 * Recover claims orphaned by a process crash between "claim" and "send"
 * (see claimAndSend). Safe to call every scheduler tick — a claim that is
 * still legitimately in-flight from THIS run cannot be older than a few
 * seconds, well under the threshold.
 */
export async function sweepStaleNotificationClaims(): Promise<number> {
  const sb = getSb();
  if (!sb) return 0;
  const cutoff = new Date(Date.now() - STALE_CLAIM_MINUTES * 60 * 1000).toISOString();
  const { data, error } = await sb
    .from('notification_log')
    .delete()
    .eq('sent_count', 0)
    .lt('created_at', cutoff)
    .select('id');
  if (error) {
    console.warn('[Proactive] stale-claim sweep failed:', error.message);
    return 0;
  }
  return (data || []).length;
}

// ── A. Installment Due — triggered when an auction completes ───

/**
 * Notify members of a just-completed auction cycle who still owe money.
 * Deduped per schedule so it is sent exactly once per (member, cycle).
 */
export async function notifyInstallmentDueForAuction(auctionId: string): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, duplicate: 0, skipped_optout: 0, skipped_nobalance: 0, skipped_nomember: 0, skipped_inactive: 0, failed: 0 };
  const sb = getSb();
  if (!sb) return tally;

  const { data: auction } = await sb
    .from('auctions')
    .select('id, chit_group_id, auction_number, status, final_due_amount')
    .eq('id', auctionId)
    .maybeSingle();
  if (!auction || (auction as any).status !== 'completed' || (auction as any).auction_number == null) return tally;
  // The admin's manual settlement (AuctionSettlementModal) is the ONLY place
  // that computes the dividend and the final per-member due amount — until
  // that has run, final_due_amount is null and payment_schedules.amount is
  // still the stale pre-auction base installment. Sending now would show a
  // wrong (unsettled) figure, so wait for settlement instead of guessing.
  if ((auction as any).final_due_amount == null) return tally;

  const groupId = (auction as any).chit_group_id;
  const month = (auction as any).auction_number;

  // Members of this group.
  const { data: members } = await sb.from('chit_members').select('id').eq('chit_group_id', groupId);
  const memberIds = (members || []).map((m: any) => m.id);
  if (memberIds.length === 0) return tally;

  const { data: rows } = await sb
    .from('payment_schedules')
    .select(DUE_SELECT)
    .in('chit_member_id', memberIds)
    .eq('month_number', month)
    .eq('paid', false);

  const outcomes = await mapWithConcurrency((rows || []).map(mapDueRow), 10, async (r): Promise<SendOutcome> => {
    const remaining = Math.max(0, r.amount - r.paid_amount);
    if (remaining <= 0) return 'skipped_nobalance';
    if (!r.phone) return 'skipped_nomember';
    if (r.lacksConsent) return 'skipped_optout';
    if (r.inactive) return 'skipped_inactive';

    // amount/dividend_amount on payment_schedules already reflect the
    // settled, per-member (participation-share-adjusted) split written by
    // apply_auction_settlement — reused as-is, never recomputed.
    const baseInstallment = r.amount + r.dividendAmount;

    return claimAndSend(
      sb,
      `wa_installment_due:${r.id}`,
      'wa_installment_due',
      () => sendInstallmentDueReminder(
        r.phone,
        r.memberName,
        r.groupName,
        String(r.month_number),
        rupeesPlain(baseInstallment),
        rupeesPlain(r.dividendAmount),
        rupeesPlain(remaining),
        shortDate(r.due_date),
      ),
    );
  });

  for (const o of outcomes) tally[o]++;
  return tally;
}

// ── B. Payment Overdue — one reminder ~7 days after due date ───

/**
 * Sweep for installments unpaid 7+ days past their due date (finalized cycles
 * only) and send exactly one overdue reminder each. Reflects the remaining
 * balance, so a partially-paid installment shows only what is still owed.
 */
export async function runOverdueSweep(now: Date = new Date()): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, duplicate: 0, skipped_optout: 0, skipped_nobalance: 0, skipped_nomember: 0, skipped_inactive: 0, failed: 0 };
  const sb = getSb();
  if (!sb) return tally;

  const cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: rows } = await sb
    .from('payment_schedules')
    .select(DUE_SELECT)
    .eq('paid', false)
    .lte('due_date', cutoff)
    .gt('amount', 0);
  if (!rows || rows.length === 0) return tally;

  // Only remind for FINALIZED cycles (a completed auction exists for group+month).
  const mapped = rows.map(mapDueRow);
  const memberIds = Array.from(new Set(mapped.map((r) => r.chit_member_id)));
  const { data: memRows } = await sb.from('chit_members').select('id, chit_group_id').in('id', memberIds);
  const memberGroup = new Map<string, string>((memRows || []).map((m: any) => [m.id, m.chit_group_id]));
  const groupIds = Array.from(new Set((memRows || []).map((m: any) => m.chit_group_id)));
  const { data: aucs } = await sb
    .from('auctions')
    .select('chit_group_id, auction_number')
    .in('chit_group_id', groupIds)
    .eq('status', 'completed');
  const completed = new Set((aucs || []).map((a: any) => `${a.chit_group_id}:${a.auction_number}`));

  const eligible = mapped.filter((r) => {
    const gid = memberGroup.get(r.chit_member_id);
    return gid && completed.has(`${gid}:${r.month_number}`); // finalized cycles only
  });

  const outcomes = await mapWithConcurrency(eligible, 10, async (r): Promise<SendOutcome> => {
    const remaining = Math.max(0, r.amount - r.paid_amount);
    if (remaining <= 0) return 'skipped_nobalance';
    if (!r.phone) return 'skipped_nomember';
    if (r.lacksConsent) return 'skipped_optout';
    if (r.inactive) return 'skipped_inactive';

    return claimAndSend(
      sb,
      `wa_overdue:${r.id}`,
      'wa_overdue',
      () => sendPaymentOverdueReminder(r.phone, r.memberName, rupeesPlain(remaining), r.groupName, shortDate(r.due_date)),
    );
  });

  for (const o of outcomes) tally[o]++;
  return tally;
}

// ── D. Auction Scheduled — once, when an admin finishes configuring it ─

/**
 * Notify active (opted-in) members of a group that an auction has just been
 * scheduled by an admin (min_bid/max_bid/scheduled_at now set — the same
 * "configured" signal the admin UI itself uses to distinguish a real
 * schedule from the zero-value placeholder row created at group setup).
 * Deduped per auction id, so a reschedule (editing the same auction again)
 * does not re-notify — the dedup key is stable and this is a "sent once"
 * announcement, not a live status feed.
 */
export async function notifyAuctionScheduled(auctionId: string): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, duplicate: 0, skipped_optout: 0, skipped_nobalance: 0, skipped_nomember: 0, skipped_inactive: 0, failed: 0 };
  const sb = getSb();
  if (!sb) return tally;

  const { data: auction } = await sb
    .from('auctions')
    .select('id, chit_group_id, auction_number, status, min_bid, scheduled_at, chit_groups ( name, value )')
    .eq('id', auctionId)
    .maybeSingle();
  if (!auction) return tally;
  const a = auction as any;
  if (a.status !== 'upcoming' || !(Number(a.min_bid) > 0) || !a.scheduled_at) return tally;

  const groupName = a.chit_groups?.name || 'your chit group';
  const chitValue = rupeesPlain(Number(a.chit_groups?.value || 0));
  const when = new Date(a.scheduled_at);
  const dateStr = shortDate(a.scheduled_at);
  const timeStr = when.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  const { data: members } = await sb
    .from('chit_members')
    .select('id, bid_status, customers ( full_name, phone, whatsapp_opt_in, whatsapp_opt_out_at )')
    .eq('chit_group_id', a.chit_group_id);

  const outcomes = await mapWithConcurrency(members || [], 10, async (m): Promise<SendOutcome> => {
    const cust = (m as any).customers;
    if (!cust?.phone) return 'skipped_nomember';
    if (cust.whatsapp_opt_in !== true) return 'skipped_optout';
    if (!ACTIVE_BID_STATUSES.includes((m as any).bid_status)) return 'skipped_inactive';
    const name = (cust.full_name || 'Member').split(' ')[0];

    // Keyed per (auction, member) — every member of the group must get their
    // own claim, otherwise only the first to claim the auction-level key
    // would ever be notified.
    return claimAndSend(
      sb,
      `wa_auction_scheduled:${auctionId}:${(m as any).id}`,
      'wa_auction_scheduled',
      () => sendAuctionScheduledNotice(cust.phone, name, groupName, String(a.auction_number), dateStr, timeStr, chitValue),
    );
  });

  for (const o of outcomes) tally[o]++;
  return tally;
}

// ── E. Auction Reminder — personal, only for members who opted in ─────

/**
 * Notify only the members who explicitly set a reminder for THIS auction
 * (auction_reminders row) that it is starting soon. This is what makes the
 * member-facing reminder bell (Frontend/lib/hooks/useReminder.ts) actually
 * do something — previously the "starting soon" push went to every group
 * member regardless of who set a reminder, so the toggle had no effect.
 * The group-wide "starting soon" push (server.ts) is unchanged; this is an
 * additional, personal WhatsApp message layered on top for opted-in members.
 * Deduped per (auction, member) so re-scanning the same auction on later
 * ticks is a no-op, not a re-send.
 */
export async function notifyAuctionReminders(auctionId: string): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, duplicate: 0, skipped_optout: 0, skipped_nobalance: 0, skipped_nomember: 0, skipped_inactive: 0, failed: 0 };
  const sb = getSb();
  if (!sb) return tally;

  const { data: auction } = await sb
    .from('auctions')
    .select('id, chit_group_id, auction_number, scheduled_at, status, chit_groups ( name )')
    .eq('id', auctionId)
    .maybeSingle();
  if (!auction) return tally;
  const a = auction as any;
  if (a.status !== 'upcoming' || !a.scheduled_at) return tally;

  const groupName = a.chit_groups?.name || 'your chit group';
  const minutesUntil = Math.max(0, Math.round((new Date(a.scheduled_at).getTime() - Date.now()) / 60000));

  // auction_reminders.user_id is auth.uid() (a real Supabase Auth session),
  // not customers.id — resolve to the customer via auth_user_id, matching
  // the identity chain established by public.current_customer_id() (see
  // 037_admin_auth_rework.sql).
  const { data: reminders } = await sb
    .from('auction_reminders')
    .select('user_id')
    .eq('auction_id', auctionId);
  if (!reminders || reminders.length === 0) return tally;

  const userIds = reminders.map((r: any) => r.user_id);
  const { data: customers } = await sb
    .from('customers')
    .select('id, full_name, phone, whatsapp_opt_in, whatsapp_opt_out_at, auth_user_id')
    .in('auth_user_id', userIds);

  // Only remind members whose reminder-holding auth user still maps to an
  // ACTIVE membership of this specific group (mirrors ACTIVE_BID_STATUSES
  // gating used everywhere else in this file) — a member who left the
  // group after setting a reminder should not still get pinged.
  const { data: memberRows } = await sb
    .from('chit_members')
    .select('customer_id, bid_status')
    .eq('chit_group_id', a.chit_group_id)
    .in('customer_id', (customers || []).map((c: any) => c.id));
  const activeCustomerIds = new Set(
    (memberRows || []).filter((m: any) => ACTIVE_BID_STATUSES.includes(m.bid_status)).map((m: any) => m.customer_id),
  );

  const outcomes = await mapWithConcurrency(customers || [], 10, async (c: any): Promise<SendOutcome> => {
    if (!c.phone) return 'skipped_nomember';
    if (c.whatsapp_opt_in !== true) return 'skipped_optout';
    if (!activeCustomerIds.has(c.id)) return 'skipped_inactive';
    const name = (c.full_name || 'Member').split(' ')[0];

    return claimAndSend(
      sb,
      `wa_auction_reminder:${auctionId}:${c.id}`,
      'wa_auction_reminder',
      () => sendAuctionReminderNotice(c.phone, name, groupName, String(a.auction_number), String(minutesUntil)),
    );
  });

  for (const o of outcomes) tally[o]++;
  return tally;
}

// ── F. Staff daily digest — collections follow-up worklist ────

/**
 * Send each active staff member with at least one assigned follow-up TODAY
 * a single WhatsApp message listing their tasks. Called automatically at
 * the end of Backend/src/collections/service.ts generateAndNotifyToday(),
 * and available as a manual "Re-send digest" action for after the admin
 * reassigns tasks later in the day (so reassignment doesn't spam a resend
 * on every single change). Deduped per (staff, day) — re-running the same
 * day's generation does not re-send.
 *
 * Uses the plain session text API (not a template) — this is an internal
 * operational message to staff, not a customer-facing business-initiated
 * message, so it is not registered as an approved WhatsApp template. Like
 * any WhatsApp session message, the staff number must have an open 24-hour
 * session with the business number (i.e. have messaged it at least once).
 */
export async function notifyStaffDailyDigest(now: Date = new Date()): Promise<Record<SendOutcome, number>> {
  const tally: Record<SendOutcome, number> = { sent: 0, duplicate: 0, skipped_optout: 0, skipped_nobalance: 0, skipped_nomember: 0, skipped_inactive: 0, failed: 0 };
  const sb = getSb();
  if (!sb) return tally;

  const today = now.toISOString().slice(0, 10);

  const { data: rows } = await sb
    .from('collection_followups')
    .select(`
      assigned_staff_id, amount_due, days_overdue,
      chit_members ( customers ( full_name, phone ) )
    `)
    .eq('follow_up_date', today)
    .eq('status', 'pending')
    .not('assigned_staff_id', 'is', null);
  if (!rows || rows.length === 0) return tally;

  const byStaff = new Map<string, any[]>();
  for (const r of rows as any[]) {
    const list = byStaff.get(r.assigned_staff_id) || [];
    list.push(r);
    byStaff.set(r.assigned_staff_id, list);
  }

  const staffIds = Array.from(byStaff.keys());
  const { data: staff } = await sb
    .from('staff_members')
    .select('id, full_name, phone, active')
    .in('id', staffIds)
    .eq('active', true);

  const outcomes = await mapWithConcurrency(staff || [], 5, async (s: any): Promise<SendOutcome> => {
    if (!s.phone) return 'skipped_nomember';
    const tasks = byStaff.get(s.id) || [];
    if (tasks.length === 0) return 'skipped_nobalance';

    const lines = tasks.slice(0, 30).map((t: any, i: number) => {
      const cust = t.chit_members?.customers;
      const name = cust?.full_name || 'Customer';
      const phone = cust?.phone || '';
      const overdueLabel = t.days_overdue > 0 ? `${t.days_overdue}d overdue` : 'due today';
      return `${i + 1}) ${name} — ₹${rupeesPlain(t.amount_due)} — ${overdueLabel} — ${phone}`;
    });
    const message = `Today's follow-ups (${tasks.length}):\n\n${lines.join('\n')}`;

    return claimAndSend(
      sb,
      `staff_digest:${s.id}:${today}`,
      'staff_digest',
      () => sendTextMessage(normalizePhoneToGupshup(s.phone), message),
    );
  });

  for (const o of outcomes) tally[o]++;
  return tally;
}

// ── C. Partial Payment — after a verified partial payment ─────

export interface PartialNotifyInput {
  scheduleId: string;
  chitMemberId: string;
  paymentId: string;    // razorpay payment id → makes the dedup key unique per payment
  appliedAmount: number;
  remaining: number;
}

export async function notifyPartialPayment(input: PartialNotifyInput): Promise<SendOutcome> {
  const sb = getSb();
  if (!sb) return 'failed';

  const { data: member } = await sb
    .from('chit_members')
    .select('id, chit_groups ( name ), customers ( full_name, phone, whatsapp_opt_in, whatsapp_opt_out_at )')
    .eq('id', input.chitMemberId)
    .maybeSingle();
  const cust = (member as any)?.customers;
  if (!cust?.phone) return 'skipped_nomember';
  if (cust.whatsapp_opt_in !== true) return 'skipped_optout';

  const name = (cust.full_name || 'Member').split(' ')[0];
  const groupName = (member as any)?.chit_groups?.name || 'your chit group';

  return claimAndSend(
    sb,
    `wa_partial:${input.scheduleId}:${input.paymentId}`,
    'wa_partial',
    () => sendPartialPaymentNotice(
      cust.phone,
      name,
      rupeesPlain(input.appliedAmount),
      groupName,
      rupeesPlain(input.remaining),
    ),
  );
}
