// ============================================================
// Collections Follow-up worklist — generation
// ============================================================
// Finds real, unpaid, finalized installments and turns them into a daily
// task list for staff to call about. Eligibility mirrors the exact rule
// already used for WhatsApp due/overdue reminders (Backend/src/whatsapp/
// proactiveNotifications.ts runOverdueSweep / notifyInstallmentDueForAuction)
// — a completed auction must exist for that group+month before an amount is
// "finalized" and worth calling about. One source of truth, not a new rule.
//
// suggested_action text is plain, rule-based, and explicitly NOT framed as
// AI/analysis — see Frontend/app/(tabs)/join.tsx for why that framing was
// removed elsewhere in this codebase.
// ============================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyStaffDailyDigest } from '../whatsapp/proactiveNotifications';

let _sb: SupabaseClient | null = null;
function getSb(): SupabaseClient | null {
  if (_sb) return _sb;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _sb = createClient(url, key, { auth: { persistSession: false } });
  return _sb;
}

/** Same 7-day threshold already used by runOverdueSweep for "significant". */
const HIGH_PRIORITY_DAYS_OVERDUE = 7;

/** Need at least this many past *resolved* cycles before a late-payment
 * ratio is trusted enough to escalate priority — one late cycle out of one
 * isn't a pattern. */
const LATE_HISTORY_MIN_SAMPLES = 2;
const LATE_HISTORY_RATIO_THRESHOLD = 0.5;

function toDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(dueDate: string, today: Date): number {
  const due = new Date(`${dueDate}T00:00:00Z`);
  const diffMs = today.getTime() - due.getTime();
  return Math.floor(diffMs / 86400000);
}

/** Real behavioral facts about a member, computed from their own history —
 * never invented, always stated plainly in suggested_action so staff (and
 * the member, if it ever came up) can see exactly what it's based on. */
export interface MemberRiskSignals {
  brokenPromises: number;
  lateRatio: number | null; // null = not enough resolved history to judge
  noResponseCount: number;
}

function derivePriority(daysOverdue: number, signals: MemberRiskSignals): 'high' | 'medium' | 'low' {
  let base: 'high' | 'medium' | 'low' =
    daysOverdue >= HIGH_PRIORITY_DAYS_OVERDUE ? 'high' : daysOverdue >= 1 ? 'medium' : 'low';

  const hasRiskHistory =
    signals.brokenPromises > 0 ||
    (signals.lateRatio !== null && signals.lateRatio >= LATE_HISTORY_RATIO_THRESHOLD);

  if (hasRiskHistory) {
    if (base === 'low') base = 'medium';
    else if (base === 'medium') base = 'high';
  }

  return base;
}

function rupeesPlain(paise: number): string {
  return Math.round(Number(paise || 0) / 100).toLocaleString('en-IN');
}

/** Plain, rule-based suggestion text — never claims to be AI-generated.
 * Any history-based escalation is spelled out as the real fact it's based
 * on, not just a raised priority badge. Only ever called for daysOverdue
 * >= 0 — generateTodaysFollowups excludes anything still inside the
 * post-settlement grace period, so there is no "not yet due" case here. */
function buildSuggestedAction(remainingPaise: number, daysOverdue: number, signals: MemberRiskSignals): string {
  const amount = `₹${rupeesPlain(remainingPaise)}`;

  const facts: string[] = [];
  if (signals.brokenPromises > 0) {
    facts.push(`broke ${signals.brokenPromises} earlier payment promise${signals.brokenPromises === 1 ? '' : 's'}`);
  }
  if (signals.lateRatio !== null && signals.lateRatio >= LATE_HISTORY_RATIO_THRESHOLD) {
    facts.push(`paid late in ${Math.round(signals.lateRatio * 100)}% of past cycles`);
  }
  if (signals.noResponseCount > 0) {
    facts.push(`didn't respond to ${signals.noResponseCount} earlier follow-up${signals.noResponseCount === 1 ? '' : 's'}`);
  }
  const historyNote = facts.length > 0 ? ` — ${facts.join('; ')}` : '';

  if (daysOverdue >= HIGH_PRIORITY_DAYS_OVERDUE) {
    return `${amount} overdue by ${daysOverdue} days${historyNote} — call today, offer partial payment if needed.`;
  }
  if (daysOverdue >= 1) {
    return `${amount} overdue by ${daysOverdue} day${daysOverdue === 1 ? '' : 's'}${historyNote} — quick follow-up call.`;
  }
  return `${amount} due today${historyNote} — reminder call recommended.`;
}

/**
 * Batched (no N+1) computation of each member's risk signals, from real
 * prior data only:
 *  - lateRatio excludes the schedule currently being scored (a row can't be
 *    its own history) and only counts cycles whose due_date has already
 *    passed, so it never leaks the future.
 *  - brokenPromises / noResponseCount only look at follow-ups strictly
 *    before today (follow_up_date < today).
 */
async function computeRiskSignals(
  sb: SupabaseClient,
  memberIds: string[],
): Promise<Map<string, { schedules: Array<{ id: string; due_date: string; paid: boolean; paid_at: string | null }> }>> {
  const scheduleHistory = new Map<string, Array<{ id: string; due_date: string; paid: boolean; paid_at: string | null }>>();
  if (memberIds.length === 0) return new Map();

  const { data: allSchedules } = await sb
    .from('payment_schedules')
    .select('id, chit_member_id, due_date, paid, paid_at')
    .in('chit_member_id', memberIds);
  for (const s of allSchedules || []) {
    const list = scheduleHistory.get((s as any).chit_member_id) || [];
    list.push({ id: (s as any).id, due_date: (s as any).due_date, paid: (s as any).paid, paid_at: (s as any).paid_at });
    scheduleHistory.set((s as any).chit_member_id, list);
  }

  return new Map(Array.from(scheduleHistory.entries()).map(([id, schedules]) => [id, { schedules }]));
}

async function computeFollowupHistory(
  sb: SupabaseClient,
  memberIds: string[],
  today: string,
): Promise<Map<string, Array<{ status: string; payment_schedule_id: string }>>> {
  const history = new Map<string, Array<{ status: string; payment_schedule_id: string }>>();
  if (memberIds.length === 0) return history;

  const { data: pastFollowups } = await sb
    .from('collection_followups')
    .select('chit_member_id, status, payment_schedule_id')
    .in('chit_member_id', memberIds)
    .lt('follow_up_date', today);
  for (const f of pastFollowups || []) {
    const list = history.get((f as any).chit_member_id) || [];
    list.push({ status: (f as any).status, payment_schedule_id: (f as any).payment_schedule_id });
    history.set((f as any).chit_member_id, list);
  }
  return history;
}

export interface GenerateResult {
  generated: number;
  skippedExisting: number;
  eligible: number;
}

/**
 * Build today's collections follow-up list from real, unpaid, finalized
 * installments. Idempotent — safe to call more than once for the same day
 * (ON CONFLICT DO NOTHING on the (member, schedule, day) unique key).
 */
export async function generateTodaysFollowups(now: Date = new Date()): Promise<GenerateResult> {
  const sb = getSb();
  if (!sb) return { generated: 0, skippedExisting: 0, eligible: 0 };

  const today = toDay(now);

  // Unpaid, amount-bearing schedules — same base filter as
  // proactiveNotifications.ts DUE_SELECT.
  const { data: rows, error: rowsErr } = await sb
    .from('payment_schedules')
    .select(`
      id, chit_member_id, month_number, due_date, amount, paid_amount,
      chit_members ( chit_group_id, bid_status, customers ( full_name ) )
    `)
    .eq('paid', false)
    .gt('amount', 0);
  if (rowsErr || !rows || rows.length === 0) return { generated: 0, skippedExisting: 0, eligible: 0 };

  // Only finalized cycles (a completed auction exists for group+month) —
  // identical rule to runOverdueSweep/getOutstandingDues.
  const groupIds = Array.from(
    new Set(rows.map((r: any) => r.chit_members?.chit_group_id).filter(Boolean)),
  );
  const { data: aucs } = await sb
    .from('auctions')
    .select('chit_group_id, auction_number')
    .in('chit_group_id', groupIds)
    .eq('status', 'completed');
  const completed = new Set((aucs || []).map((a: any) => `${a.chit_group_id}:${a.auction_number}`));

  const ACTIVE_BID_STATUSES = ['active', 'bidding'];

  // This is a collections worklist, not a reminder feed — it must only ever
  // contain amounts actually due today or overdue. apply_auction_settlement
  // gives every member a 7-day grace period after settlement (due_date =
  // settlement date + 7), so a schedule can be finalized (completed auction)
  // and still not be due yet. Excluding those here — not just clamping the
  // displayed days-overdue — is what keeps "not yet due" out of the list
  // entirely instead of showing up as a false "due soon" entry.
  const eligible = rows.filter((r: any) => {
    const gid = r.chit_members?.chit_group_id;
    if (!gid || !completed.has(`${gid}:${r.month_number}`)) return false;
    if (!ACTIVE_BID_STATUSES.includes(r.chit_members?.bid_status)) return false;
    const remaining = Number(r.amount || 0) - Number(r.paid_amount || 0);
    if (remaining <= 0) return false;
    return daysBetween(r.due_date, now) >= 0;
  });

  // Note: do NOT early-return when nothing is eligible. Today's stale
  // 'pending' rows still need clearing (an item that became not-yet-due or
  // got paid should leave the list), so fall through to the cleanup + insert
  // path below even with an empty eligible set.

  // Real behavioral history, fetched once for every member in this batch
  // (not per-row) — see computeRiskSignals/computeFollowupHistory for the
  // no-leakage rules (a row never counts as its own history; only strictly
  // prior follow-ups/resolved cycles count).
  const memberIds = Array.from(new Set(eligible.map((r: any) => r.chit_member_id)));
  const [scheduleHistoryMap, followupHistoryMap] = await Promise.all([
    computeRiskSignals(sb, memberIds),
    computeFollowupHistory(sb, memberIds, today),
  ]);

  const inserts = eligible.map((r: any) => {
    const remaining = Number(r.amount || 0) - Number(r.paid_amount || 0);
    const daysOverdue = daysBetween(r.due_date, now);

    const schedules = (scheduleHistoryMap.get(r.chit_member_id)?.schedules || [])
      .filter((s) => s.id !== r.id && s.due_date < today);
    const resolved = schedules.filter((s) => s.paid);
    const lateCount = resolved.filter((s) => s.paid_at && s.paid_at.slice(0, 10) > s.due_date).length;
    const lateRatio = resolved.length >= LATE_HISTORY_MIN_SAMPLES ? lateCount / resolved.length : null;

    const pastFollowups = followupHistoryMap.get(r.chit_member_id) || [];
    const paidScheduleIds = new Set(schedules.filter((s) => s.paid).map((s) => s.id));
    const brokenPromises = pastFollowups.filter(
      (f) => f.status === 'promised' && !paidScheduleIds.has(f.payment_schedule_id),
    ).length;
    const noResponseCount = pastFollowups.filter((f) => f.status === 'no_response').length;

    const signals: MemberRiskSignals = { brokenPromises, lateRatio, noResponseCount };

    return {
      chit_member_id: r.chit_member_id,
      payment_schedule_id: r.id,
      follow_up_date: today,
      priority: derivePriority(daysOverdue, signals),
      days_overdue: Math.max(0, daysOverdue),
      amount_due: remaining,
      suggested_action: buildSuggestedAction(remaining, daysOverdue, signals),
      status: 'pending' as const,
    };
  });

  // Self-healing regeneration. Previously this was append-only
  // (ON CONFLICT DO NOTHING), which meant a stale or wrongly-included row
  // could never be corrected or removed once written — a not-yet-due item
  // generated by an older rule stayed in the list forever. Now we reconcile
  // today's rows against the current eligible set with two precise deletes:
  //
  //   (a) ANY today row whose schedule is no longer eligible (not-yet-due,
  //       now paid, cancelled, etc.) is removed regardless of its status —
  //       this is what evicts a stale "due soon" row even after staff
  //       touched it.
  //   (b) Remaining eligible rows that are still 'pending' (untouched) are
  //       deleted so they can be re-inserted fresh with the current
  //       priority/text.
  //
  // What survives: eligible rows a staff member already acted on
  // (contacted/promised/collected/no_response) — their work is preserved,
  // and the insert's ON CONFLICT DO NOTHING leaves them intact.
  const eligibleScheduleIds = eligible.map((r: any) => r.id);

  // (a) Evict no-longer-eligible rows for today. When nothing is eligible,
  // the NOT-IN filter would be empty, so delete all of today's rows instead.
  let evictQuery = sb.from('collection_followups').delete().eq('follow_up_date', today);
  if (eligibleScheduleIds.length > 0) {
    evictQuery = evictQuery.not(
      'payment_schedule_id',
      'in',
      `(${eligibleScheduleIds.join(',')})`,
    );
  }
  const { error: evictErr } = await evictQuery;
  if (evictErr) {
    console.error('[Collections] follow-up eviction failed:', evictErr.message);
    return { generated: 0, skippedExisting: 0, eligible: eligible.length };
  }

  // (b) Refresh untouched eligible rows.
  const { error: delErr } = await sb
    .from('collection_followups')
    .delete()
    .eq('follow_up_date', today)
    .eq('status', 'pending');
  if (delErr) {
    console.error('[Collections] follow-up stale-row cleanup failed:', delErr.message);
    return { generated: 0, skippedExisting: 0, eligible: eligible.length };
  }

  if (inserts.length === 0) {
    // Nothing due today — cleanup above already emptied the pending list.
    return { generated: 0, skippedExisting: 0, eligible: 0 };
  }

  const { data: inserted, error: insErr } = await sb
    .from('collection_followups')
    .upsert(inserts, {
      onConflict: 'chit_member_id,payment_schedule_id,follow_up_date',
      ignoreDuplicates: true,
    })
    .select('id');
  if (insErr) {
    console.error('[Collections] follow-up generation insert failed:', insErr.message);
    return { generated: 0, skippedExisting: 0, eligible: eligible.length };
  }

  const generated = (inserted || []).length;
  return { generated, skippedExisting: eligible.length - generated, eligible: eligible.length };
}

/**
 * Run generation, then (best-effort) send each active staff member with an
 * assigned task today their WhatsApp digest. Safe to call from the daily
 * scheduler tick or the admin's "Generate Today's List" button.
 */
export async function generateAndNotifyToday(now: Date = new Date()): Promise<GenerateResult> {
  const result = await generateTodaysFollowups(now);
  try {
    await notifyStaffDailyDigest(now);
  } catch (err) {
    console.warn('[Collections] staff digest send failed:', err);
  }
  return result;
}
