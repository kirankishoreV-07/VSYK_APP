import express, { Request, Response } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import Razorpay from 'razorpay';
import crypto from 'crypto';
import admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import { whatsappRouter } from './whatsapp';
import { authRouter } from './auth/otp';
import { paymentsRouter } from './payments/payments';
import { notifyInstallmentDueForAuction, runOverdueSweep, notifyAuctionScheduled, notifyAuctionReminders, sweepStaleNotificationClaims } from './whatsapp/proactiveNotifications';
import { requireAdminAuth } from './middleware/adminAuth';
import { accountRouter } from './account/deletion';
import { collectionsRouter } from './collections/router';
import { generateAndNotifyToday } from './collections/service';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Managed hosts (Railway, Render, Fly) terminate TLS at a proxy and pass the
// caller's address in X-Forwarded-For. Without this, req.ip resolves to the
// proxy for every request, so express-rate-limit counts the entire user base
// as a single client and everyone shares one 300-per-15-minute bucket.
// The value is the number of proxy hops to trust — 1 for a standard managed
// host. Set TRUST_PROXY_HOPS=0 when running with no proxy in front.
app.set('trust proxy', Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10) || 0);

const razorpayKeyId = process.env.RAZORPAY_KEY_ID || '';
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || '';
const razorpay = razorpayKeyId && razorpayKeySecret
  ? new Razorpay({ key_id: razorpayKeyId, key_secret: razorpayKeySecret })
  : null;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON || '';
const serviceAccountBase64 = process.env.FCM_SERVICE_ACCOUNT_BASE64 || '';
let firebaseReady = false;

try {
  if (serviceAccountJson || serviceAccountBase64) {
    const raw = serviceAccountJson
      ? serviceAccountJson
      : Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
    const serviceAccount = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    firebaseReady = true;
  }
} catch (err) {
  console.warn('FCM init failed:', err);
}

// CORS: only relevant to browser-origin requests (the native Expo app,
// Gupshup's webhook, and server-to-server calls never send an Origin header
// at all, so they are unaffected either way). ALLOWED_ORIGINS is a
// comma-separated allowlist for any web-based frontend (e.g. an Expo web
// build or an admin web console); previously cors() defaulted to '*' (any
// origin). Empty/unset ALLOWED_ORIGINS denies all browser cross-origin
// access while still allowing every non-browser client.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
}));

// Baseline IP-level rate limiting. This is independent of (and in addition
// to) the OTP-specific per-phone/per-window limits in auth/otp.ts — those
// stop one phone number from being hammered, this stops one IP from
// hammering the API with many different phone numbers/requests.
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Math.max(1, Number.parseInt(process.env.API_RATE_LIMIT_MAX || '300', 10) || 300),
  standardHeaders: true,
  legacyHeaders: false,
}));
// Tighter limit specifically on the OTP endpoints (auth abuse is the
// highest-value target here) — defense in depth on top of the app-level
// per-phone limits already enforced inside auth/otp.ts.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Math.max(1, Number.parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10) || 20),
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json());
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/auth', otpLimiter, authRouter);
app.use('/api/account', accountRouter);
app.use('/api/collections', collectionsRouter);

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: 'VSYK Chits Backend is running!' });
});

async function sendPushToCustomers(
  customerIds: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  if (!firebaseReady || !supabaseAdmin || customerIds.length === 0) {
    return { sent: 0, failed: 0 };
  }

  const { data: tokens } = await supabaseAdmin
    .from('member_device_tokens')
    .select('fcm_token')
    .in('customer_id', customerIds);

  const tokenList = Array.from(new Set((tokens || []).map((t: any) => t.fcm_token).filter(Boolean)));
  if (tokenList.length === 0) return { sent: 0, failed: 0 };

  const response = await admin.messaging().sendEachForMulticast({
    tokens: tokenList,
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
  });

  return { sent: response.successCount, failed: response.failureCount };
}

async function getGroupMemberCustomerIds(chitGroupId: string) {
  if (!supabaseAdmin) return [] as string[];
  const { data } = await supabaseAdmin
    .from('chit_members')
    .select('customer_id')
    .eq('chit_group_id', chitGroupId);
  return (data || []).map((row: any) => row.customer_id).filter(Boolean);
}

// Send a push exactly once for a given logical event. The scheduler ticks every
// 60s, so reminders (e.g. "starting in 10 min", "payment due") would otherwise
// fire repeatedly. We claim the event by inserting its unique key into
// notification_log first; a duplicate-key error (23505) means another tick
// already sent it, so we silently skip.
async function sendOnce(
  key: string,
  type: string,
  customerIds: string[],
  payload: { title: string; body: string; data?: Record<string, string> },
) {
  if (!supabaseAdmin) return { sent: 0, failed: 0, skipped: true };

  const { error: claimError } = await supabaseAdmin
    .from('notification_log')
    .insert({ notification_key: key, notification_type: type });

  if (claimError) {
    // 23505 = unique_violation → already sent on a previous tick. Not an error.
    if ((claimError as any).code !== '23505') {
      console.warn('notification_log claim failed:', claimError.message);
    }
    return { sent: 0, failed: 0, skipped: true };
  }

  const result = await sendPushToCustomers(customerIds, payload);

  await supabaseAdmin
    .from('notification_log')
    .update({ sent_count: result.sent })
    .eq('notification_key', key);

  return { ...result, skipped: false };
}

const rupees = (paise: number | null | undefined) =>
  `₹${Math.round(Number(paise || 0) / 100).toLocaleString('en-IN')}`;

// runAuctionScheduler is triggered both by the 60s setInterval below AND by
// the manual /api/auctions/scheduler/run endpoint. Neither had a guard
// against overlapping runs — if a tick takes >60s (slow Supabase, large
// backlog), the next interval tick (or a manual trigger) could start while
// the previous one is still writing (auction status flips, payment_schedules
// updates), racing on the same rows. Per-notification dedup already makes
// double *sends* safe, but the underlying auction-state writes are not
// idempotent against a genuine concurrent run, so a simple in-process lock
// is enough (single backend instance; no cross-process coordination needed).
let schedulerInFlight = false;

async function runAuctionScheduler() {
  if (schedulerInFlight) {
    console.warn('[Scheduler] Skipped — previous run still in flight.');
    return { opened: 0, closed: 0, reminded: 0, paymentReminders: 0, skippedOverlap: true };
  }
  schedulerInFlight = true;
  try {
    return await runAuctionSchedulerInner();
  } finally {
    schedulerInFlight = false;
  }
}

async function runAuctionSchedulerInner() {
  if (!supabaseAdmin) return { opened: 0, closed: 0, reminded: 0, paymentReminders: 0 };

  // Recover any WhatsApp notification claim orphaned by a prior process
  // crash mid-send before doing anything else this tick.
  try {
    const recovered = await sweepStaleNotificationClaims();
    if (recovered > 0) console.warn(`[Scheduler] Recovered ${recovered} stale notification claim(s).`);
  } catch (err) {
    console.warn('[Scheduler] Stale-claim sweep failed:', err);
  }

  const now = new Date();
  const nowIso = now.toISOString();

  // ── 0. Collections follow-ups: generate once per calendar day ────────────
  // Reuses the existing notification_log unique-key dedup pattern (same
  // table every other "send exactly once" claim in this file already uses)
  // instead of a new mechanism — the claim itself is the "already generated
  // today" marker, no row insert into it beyond that.
  const today = nowIso.slice(0, 10);
  const { error: followupsClaimError } = await supabaseAdmin
    .from('notification_log')
    .insert({ notification_key: `followups_generated:${today}`, notification_type: 'followups_generated' });
  if (!followupsClaimError) {
    try {
      await generateAndNotifyToday(now);
    } catch (err) {
      console.warn('[Scheduler] Collections follow-up generation failed:', err);
    }
  } else if ((followupsClaimError as any).code !== '23505') {
    console.warn('[Scheduler] Follow-up generation claim failed:', followupsClaimError.message);
  }

  // ── 1. "Starting soon" reminder: 10 minutes before scheduled_at ──────────
  // Notify members of upcoming auctions whose start is within the next 10 min.
  // sendOnce keyed by auction id guarantees a single reminder despite 60s ticks.
  const tenMinFromNow = new Date(now.getTime() + 10 * 60 * 1000).toISOString();
  const { data: startingSoon } = await supabaseAdmin
    .from('auctions')
    .select('id, chit_group_id, auction_number, scheduled_at, chit_groups(name)')
    .eq('status', 'upcoming')
    .gt('scheduled_at', nowIso)
    .lte('scheduled_at', tenMinFromNow);

  let reminded = 0;
  for (const auction of startingSoon || []) {
    const groupName = (auction as any).chit_groups?.name || 'Your group';
    const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
    const res = await sendOnce(
      `auction_starting_soon:${auction.id}`,
      'auction_starting_soon',
      memberIds,
      {
        title: 'Auction Starting Soon',
        body: `${groupName} Auction #${auction.auction_number || ''} starts in about 10 minutes. Get ready to bid!`,
        data: { auctionId: auction.id, type: 'auction_starting_soon' },
      },
    );
    if (!res.skipped) reminded += 1;

    // Personal WhatsApp reminder — ONLY for members who set the reminder
    // bell on this specific auction (auction_reminders), on top of the
    // group-wide push above. This is what makes that toggle actually do
    // something (previously the push above went out regardless of it).
    try {
      await notifyAuctionReminders(auction.id);
    } catch (err) {
      console.warn('[Scheduler] WhatsApp auction-reminder notify failed for', auction.id, err);
    }
  }

  // ── 2. Open auctions whose scheduled_at has passed → go live ─────────────
  // PLACEHOLDER_SCHEDULE_SENTINEL excludes never-actually-scheduled auction
  // rows: Frontend/lib/auctionUtils.ts creates placeholder rows (min_bid: 0,
  // no admin action taken yet) with scheduled_at pinned to 1970-01-01 as a
  // "not really scheduled" sentinel (DB requires scheduled_at NOT NULL). That
  // sentinel is always <= now, so without this filter EVERY unconfigured
  // placeholder across the whole app looks "due to open" — this caused a
  // real incident (2026-08-17): a single tick flooded auction_events with
  // 12,615+ spurious 'started' rows for placeholders no admin ever scheduled.
  const PLACEHOLDER_SCHEDULE_SENTINEL = '1970-01-01T00:00:00.000Z';
  const { data: toOpen } = await supabaseAdmin
    .from('auctions')
    .select('id, chit_group_id, auction_number, chit_groups(name)')
    .eq('status', 'upcoming')
    .gt('scheduled_at', PLACEHOLDER_SCHEDULE_SENTINEL)
    .lte('scheduled_at', nowIso);

  const openIds = (toOpen || []).map((a: any) => a.id);
  if (openIds.length > 0) {
    const { error: openErr } = await supabaseAdmin.from('auctions').update({ status: 'live' }).in('id', openIds);
    if (openErr) {
      // Previously unchecked — a large batch could fail the bulk update
      // (e.g. a huge `id=in.(...)` filter) while the event-log insert below
      // still succeeded, silently desyncing "logged as started" from "is
      // actually live". Bail out rather than log a 'started' event for
      // auctions that were never actually flipped to live.
      console.error('[Scheduler] Bulk auction open update failed — skipping event log/notify for this batch:', openErr.message);
    } else {
      await supabaseAdmin.from('auction_events').insert(
        openIds.map((id: string) => ({
          auction_id: id,
          event_type: 'started',
          performed_by: 'System',
          notes: 'Auction opened automatically',
        }))
      );

      for (const auction of toOpen || []) {
        const groupName = (auction as any).chit_groups?.name || 'Your group';
        const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
        // Keyed by auction id so the "started" push is sent exactly once even if
        // the status update and this loop overlap with the next tick.
        await sendOnce(
          `auction_live:${auction.id}`,
          'auction_live',
          memberIds,
          {
            title: 'Auction Started',
            body: `${groupName} Auction #${auction.auction_number || ''} has started. Tap to place your bid now!`,
            data: { auctionId: auction.id, type: 'auction_live' },
          },
        );
      }
    }
  }

  const { data: toClose } = await supabaseAdmin
    .from('auctions')
    .select('id, chit_group_id, auction_number, chit_groups(name, value, capacity, monthly_installment, agent_commission_rate)')
    .eq('status', 'live')
    .lte('closes_at', nowIso);

  for (const auction of toClose || []) {
    // Winner = HIGHEST active (non-retracted) discount bid. This must match the
    // DB triggers (025_highest_bid_wins), the admin Declare Winner flow, and the
    // member UI — all of which treat the highest discount as the winner. A prior
    // version ordered ascending (lowest), which auto-closed auctions with the
    // WRONG winner. Retracted bids are excluded so a retracted top bid never wins.
    const { data: highestBid } = await supabaseAdmin
      .from('auction_bids')
      .select('bid_amount, customer_id')
      .eq('auction_id', auction.id)
      .eq('is_retracted', false)
      .order('bid_amount', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: groupMembers, error: membersError } = await supabaseAdmin
      .from('chit_members')
      .select('id, customer_id, participation_share, customers(full_name)')
      .eq('chit_group_id', auction.chit_group_id);
    if (membersError) {
      console.error('[Scheduler] Could not load members for settlement:', membersError.message);
      continue;
    }

    const winnerMember = (groupMembers || []).find((m: any) => m.customer_id === highestBid?.customer_id);
    const winnerMemberId = (winnerMember as any)?.id ?? null;
    const winnerName = (winnerMember as any)?.customers?.full_name ?? null;
    const group: any = (auction as any).chit_groups || {};
    const groupValue = Number(group.value || 0);
    const totalShares = (groupMembers || []).reduce(
      (sum: number, member: any) => sum + Number(member.participation_share || 1),
      0,
    ) || Number(group.capacity || 1);
    const discountPaise = Number(highestBid?.bid_amount || 0);
    const installmentPaise = Number(group.monthly_installment || 0)
      || Math.round(groupValue / Math.max(totalShares, 1));
    const commissionRate = Math.min(Math.max(Number(group.agent_commission_rate ?? 5), 0), 100) / 100;
    const commissionPaise = Math.round(groupValue * commissionRate);
    const dividendPerSharePaise = Math.round(
      Math.max(discountPaise - commissionPaise, 0) / Math.max(totalShares, 1),
    );
    const finalDuePaise = Math.max(installmentPaise - dividendPerSharePaise, 0);
    const prizePaise = highestBid ? Math.max(groupValue - discountPaise, 0) : 0;

    const { error: settleError } = await supabaseAdmin.rpc('apply_auction_settlement', {
      p_auction_id: auction.id,
      p_winner_member_id: winnerMemberId,
      p_winner_name: winnerName,
      p_current_bid: discountPaise,
      p_installment_due: installmentPaise,
      p_dividend_amount: dividendPerSharePaise,
      p_discount_amount: discountPaise,
      p_final_due_amount: finalDuePaise,
      p_winner_prize_amount: prizePaise,
    });
    if (settleError) {
      console.error('[Scheduler] Atomic auction settlement failed:', settleError.message);
      continue;
    }

    await supabaseAdmin.from('auction_events').insert([{
      auction_id: auction.id,
      event_type: 'auto_closed',
      performed_by: 'System',
      notes: 'Auction closed automatically',
    }]);

    const groupName = (auction as any).chit_groups?.name || 'Your group';
    const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);

    // Completion notification to all members — include the amount payable when known.
    const dueLine = finalDuePaise > 0
      ? ` Your installment of ${rupees(finalDuePaise)} is now due.`
      : '';
    await sendOnce(
      `auction_completed:${auction.id}`,
      'auction_completed',
      memberIds,
      {
        title: 'Auction Completed',
        body: `${groupName} Auction #${auction.auction_number || ''} has ended.${dueLine}`,
        data: { auctionId: auction.id, type: 'auction_completed' },
      },
    );

    // Congratulate the winner separately (only if we resolved one).
    if (highestBid?.customer_id) {
      await sendOnce(
        `auction_winner:${auction.id}`,
        'auction_winner',
        [highestBid.customer_id],
        {
          title: 'You Won the Auction! 🎉',
          body: `Congratulations! You won ${groupName} Auction #${auction.auction_number || ''} with a ${rupees(highestBid.bid_amount)} discount bid.`,
          data: { auctionId: auction.id, type: 'auction_winner' },
        },
      );
    }
  }

  // ── 4. Payment due reminders (FCM) ────────────────────────────────────────
  // Notify members of unpaid installments due today or tomorrow, once each.
  const paymentReminders = await runPaymentReminders(now);

  // ── 5. WhatsApp: Installment Due for cycles completed in this tick ───────
  // Covers BOTH the auto-close path above and the admin's manual "Declare
  // Winner"/settlement flows (which write status='completed' directly from
  // the client) — every completed auction is scanned here regardless of how
  // it was completed. Deduped per schedule via notification_log, so replays
  // of already-notified auctions are cheap no-ops (no unpaid rows left).
  let waInstallmentDue = 0;
  for (const auction of toClose || []) {
    try {
      const tally = await notifyInstallmentDueForAuction(auction.id);
      waInstallmentDue += tally.sent;
    } catch (err) {
      console.warn('[Scheduler] WhatsApp installment-due notify failed for', auction.id, err);
    }
  }
  // Also sweep auctions completed recently by the admin app (not auto-closed
  // by this tick) within a short recency window, so manual declare-winner
  // gets the same notification without scanning the entire auctions table.
  try {
    const recentSince = new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    const { data: recentlyCompleted } = await supabaseAdmin
      .from('auctions')
      .select('id')
      .eq('status', 'completed')
      .gte('ended_at', recentSince);
    for (const a of recentlyCompleted || []) {
      const tally = await notifyInstallmentDueForAuction((a as any).id);
      waInstallmentDue += tally.sent;
    }
  } catch (err) {
    console.warn('[Scheduler] WhatsApp installment-due recency sweep failed:', err);
  }

  // ── 6. WhatsApp: Payment Overdue (exactly once, ~7 days after due date) ──
  let waOverdue = 0;
  try {
    const tally = await runOverdueSweep(now);
    waOverdue = tally.sent;
  } catch (err) {
    console.warn('[Scheduler] WhatsApp overdue sweep failed:', err);
  }

  // ── 7. WhatsApp: Auction Scheduled (once, when admin finishes configuring) ─
  // The admin's schedule-save is a direct frontend→Supabase write (no backend
  // hook), so this poll is the trigger: any 'upcoming' auction with a real
  // min_bid (min_bid=0 is the zero-value placeholder created at group setup,
  // never a real schedule) is "configured". notifyAuctionScheduled claims a
  // per-(auction, member) key, so re-scanning the same auction on later ticks
  // (it stays 'upcoming' until it goes live) is a cheap no-op, not a re-send.
  let waAuctionScheduled = 0;
  try {
    const { data: configured } = await supabaseAdmin
      .from('auctions')
      .select('id')
      .eq('status', 'upcoming')
      .gt('min_bid', 0);
    for (const a of configured || []) {
      const tally = await notifyAuctionScheduled((a as any).id);
      waAuctionScheduled += tally.sent;
    }
  } catch (err) {
    console.warn('[Scheduler] WhatsApp auction-scheduled notify failed:', err);
  }

  return {
    opened: openIds.length,
    closed: (toClose || []).length,
    reminded,
    paymentReminders,
    waInstallmentDue,
    waOverdue,
    waAuctionScheduled,
  };
}

// Remind members about unpaid installments that are due today or tomorrow.
// Keyed by schedule id so each due installment triggers exactly one reminder.
async function runPaymentReminders(now: Date) {
  if (!supabaseAdmin) return 0;

  // due_date is a DATE column — compare on calendar day (today + tomorrow).
  const toDay = (d: Date) => d.toISOString().slice(0, 10);
  const today = toDay(now);
  const tomorrow = toDay(new Date(now.getTime() + 24 * 60 * 60 * 1000));

  const { data: dueSchedules } = await supabaseAdmin
    .from('payment_schedules')
    .select('id, chit_member_id, amount, due_date, month_number')
    .eq('paid', false)
    .gt('amount', 0)
    .in('due_date', [today, tomorrow]);

  if (!dueSchedules || dueSchedules.length === 0) return 0;

  // Resolve customer + group name for each member in one round-trip.
  const memberIds = Array.from(new Set(dueSchedules.map((s: any) => s.chit_member_id)));
  const { data: members } = await supabaseAdmin
    .from('chit_members')
    .select('id, customer_id, chit_groups(name)')
    .in('id', memberIds);
  const memberMap = new Map<string, { customerId: string | null; groupName: string }>();
  for (const m of members || []) {
    memberMap.set((m as any).id, {
      customerId: (m as any).customer_id || null,
      groupName: (m as any).chit_groups?.name || 'your chit group',
    });
  }

  let sent = 0;
  for (const sched of dueSchedules) {
    const info = memberMap.get((sched as any).chit_member_id);
    if (!info?.customerId) continue;
    const when = (sched as any).due_date === today ? 'today' : 'tomorrow';
    const res = await sendOnce(
      `payment_due:${(sched as any).id}`,
      'payment_due',
      [info.customerId],
      {
        title: 'Payment Reminder',
        body: `Your ${rupees((sched as any).amount)} installment for ${info.groupName} is due ${when}. Please pay to stay on track.`,
        data: { type: 'payment_due', scheduleId: (sched as any).id },
      },
    );
    if (!res.skipped) sent += 1;
  }

  return sent;
}

// Payments are now server-authoritative — see src/payments/payments.ts.
// Order creation binds to the caller's own schedule; verify re-fetches the
// payment from Razorpay, records paid_amount idempotently, and only marks a
// schedule fully paid when the full amount is actually verified.
app.use('/api/payments', paymentsRouter);

// These 5 admin/scheduler routes mutate real financial data (apply-settlement
// rewrites payment_schedules.amount/dividend_amount for a whole group) or
// send real pushes. requireAdminAuth (src/middleware/adminAuth.ts) verifies
// the caller's JWT resolves to a real row in admin_users — the same check
// RLS's is_admin() uses.
app.post('/api/auctions/scheduler/run', requireAdminAuth, async (_req: Request, res: Response) => {
  try {
    const result = await runAuctionScheduler();
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'Scheduler failed.' });
  }
});

app.post('/api/auctions/notify-winner', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase not configured.' });
    const { auctionId } = req.body ?? {};
    if (!auctionId) return res.status(400).json({ error: 'auctionId is required.' });

    const { data: auction } = await supabaseAdmin
      .from('auctions')
      .select('id, chit_group_id, auction_number, winner_member_id, current_bid')
      .eq('id', auctionId)
      .maybeSingle();
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    let winnerCustomerId: string | null = null;
    if (auction.winner_member_id) {
      const { data: memberRow } = await supabaseAdmin
        .from('chit_members')
        .select('customer_id')
        .eq('id', auction.winner_member_id)
        .maybeSingle();
      winnerCustomerId = memberRow?.customer_id ?? null;
    }

    if (winnerCustomerId) {
      await sendPushToCustomers([winnerCustomerId], {
        title: 'You Won the Auction',
        body: `Congrats! You won Auction #${auction.auction_number || ''}. Credit will be processed soon.`,
        data: { auctionId: auction.id, type: 'winner_declared' },
      });
    }

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to notify winner.' });
  }
});

app.post('/api/auctions/notify-installments', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase not configured.' });
    const { auctionId, message } = req.body ?? {};
    if (!auctionId) return res.status(400).json({ error: 'auctionId is required.' });

    const { data: auction } = await supabaseAdmin
      .from('auctions')
      .select('id, chit_group_id, auction_number')
      .eq('id', auctionId)
      .maybeSingle();
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
    await sendPushToCustomers(memberIds, {
      title: 'Installment Due',
      body: message || `Installment is due for Auction #${auction.auction_number || ''}. Please pay now.`,
      data: { auctionId: auction.id, type: 'installment_due' },
    });

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to notify members.' });
  }
});

app.post('/api/auctions/notify-upcoming', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase not configured.' });
    const { auctionId } = req.body ?? {};
    if (!auctionId) return res.status(400).json({ error: 'auctionId is required.' });

    const { data: auction } = await supabaseAdmin
      .from('auctions')
      .select('id, chit_group_id, auction_number, scheduled_at')
      .eq('id', auctionId)
      .maybeSingle();
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    const memberIds = await getGroupMemberCustomerIds(auction.chit_group_id);
    await sendPushToCustomers(memberIds, {
      title: 'Auction Scheduled',
      body: `Auction #${auction.auction_number || ''} is scheduled soon. Tap to view details.`,
      data: { auctionId: auction.id, type: 'auction_scheduled' },
    });

    return res.json({ ok: true });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to notify members.' });
  }
});

app.post('/api/auctions/apply-settlement', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase not configured.' });
    const {
      auctionId, winnerMemberId, winnerName, currentBid, installmentDue,
      dividendAmount, discountAmount, finalDueAmount, winnerPrizeAmount,
    } = req.body ?? {};
    if (!auctionId) return res.status(400).json({ error: 'auctionId is required.' });

    const { data: auction, error: auctionError } = await supabaseAdmin
      .from('auctions')
      .select('id, status, chit_group_id, winner_member_id, winner_name, current_bid, installment_due, dividend_amount, discount_amount, final_due_amount, winner_prize_amount, chit_groups(value, capacity, monthly_installment, agent_commission_rate)')
      .eq('id', auctionId)
      .maybeSingle();
    if (auctionError) return res.status(500).json({ error: 'Could not load auction.' });
    if (!auction) return res.status(404).json({ error: 'Auction not found.' });

    const amount = (value: unknown, fallback: unknown) => Math.round(Number(value ?? fallback ?? 0));
    let resolvedWinnerMemberId = winnerMemberId === undefined ? auction.winner_member_id : winnerMemberId || null;
    let resolvedWinnerName = winnerName === undefined ? auction.winner_name : winnerName || null;
    let settlement = {
      currentBid: amount(currentBid, auction.current_bid),
      installmentDue: amount(installmentDue, auction.installment_due),
      dividendAmount: amount(dividendAmount, auction.dividend_amount),
      discountAmount: amount(discountAmount, auction.discount_amount),
      finalDueAmount: amount(finalDueAmount, auction.final_due_amount),
      winnerPrizeAmount: amount(winnerPrizeAmount, auction.winner_prize_amount),
    };

    // For an in-app live auction the database leaderboard is authoritative.
    // Never accept winner or financial totals calculated by a client.
    if (auction.status === 'live') {
      const [{ data: topBid, error: bidError }, { data: groupMembers, error: membersError }] = await Promise.all([
        supabaseAdmin
          .from('auction_bids')
          .select('customer_id, bid_amount, customers(full_name)')
          .eq('auction_id', auctionId)
          .eq('is_retracted', false)
          .order('bid_amount', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabaseAdmin
          .from('chit_members')
          .select('id, customer_id, participation_share, customers(full_name)')
          .eq('chit_group_id', auction.chit_group_id),
      ]);
      if (bidError || membersError) return res.status(500).json({ error: 'Could not resolve the auction result.' });

      const members = groupMembers || [];
      const winnerMember = members.find((member: any) => member.customer_id === (topBid as any)?.customer_id);
      const group: any = (auction as any).chit_groups || {};
      const groupValue = Number(group.value || 0);
      const totalShares = members.reduce(
        (sum: number, member: any) => sum + Number(member.participation_share || 1), 0,
      ) || Number(group.capacity || 1);
      const authoritativeBid = Number((topBid as any)?.bid_amount || 0);
      const commissionRate = Math.min(Math.max(Number(group.agent_commission_rate ?? 5), 0), 100) / 100;
      const commission = Math.round(groupValue * commissionRate);
      const dividendPerShare = Math.round(Math.max(authoritativeBid - commission, 0) / Math.max(totalShares, 1));
      const installment = Number(group.monthly_installment || 0) || Math.round(groupValue / Math.max(totalShares, 1));
      settlement = {
        currentBid: authoritativeBid,
        installmentDue: installment,
        dividendAmount: dividendPerShare,
        discountAmount: authoritativeBid,
        finalDueAmount: Math.max(installment - dividendPerShare, 0),
        winnerPrizeAmount: topBid ? Math.max(groupValue - authoritativeBid, 0) : 0,
      };
      resolvedWinnerMemberId = (winnerMember as any)?.id || null;
      resolvedWinnerName = (winnerMember as any)?.customers?.full_name || null;

      const supplied = { currentBid, installmentDue, dividendAmount, discountAmount, finalDueAmount, winnerPrizeAmount };
      for (const [key, value] of Object.entries(supplied)) {
        if (value !== undefined && value !== null && amount(value, 0) !== settlement[key as keyof typeof settlement]) {
          return res.status(400).json({ error: 'Settlement values do not match the authoritative auction result.' });
        }
      }
      if (winnerMemberId !== undefined && (winnerMemberId || null) !== resolvedWinnerMemberId) {
        return res.status(400).json({ error: 'Winner does not match the authoritative auction result.' });
      }
    }
    if (Object.values(settlement).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      return res.status(400).json({ error: 'Settlement contains an invalid amount.' });
    }

    const { data, error } = await supabaseAdmin.rpc('apply_auction_settlement', {
      p_auction_id: auctionId,
      p_winner_member_id: resolvedWinnerMemberId,
      p_winner_name: resolvedWinnerName,
      p_current_bid: settlement.currentBid,
      p_installment_due: settlement.installmentDue,
      p_dividend_amount: settlement.dividendAmount,
      p_discount_amount: settlement.discountAmount,
      p_final_due_amount: settlement.finalDueAmount,
      p_winner_prize_amount: settlement.winnerPrizeAmount,
    });
    if (error) {
      const message = error.message || 'Failed to apply settlement.';
      return res.status(/invalid|negative|not found|does not belong|already paid|already finalized|only a live/i.test(message) ? 400 : 500).json({ error: message });
    }

    const result: any = Array.isArray(data) ? data[0] : data;
    return res.json({ ok: true, updated: Number(result?.updated_members || 0) });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to apply settlement.' });
  }
});

// Scheduled jobs can mutate financial state and send customer notifications.
// Require an explicit production opt-in so starting a local/API-only server
// for login testing can never trigger those side effects.
if (process.env.ENABLE_SCHEDULER === 'true') {
  setInterval(() => {
    runAuctionScheduler().catch((err) => console.warn('Scheduler error:', err));
  }, 60 * 1000);
} else {
  console.log('[Scheduler] Disabled (set ENABLE_SCHEDULER=true to enable).');
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
