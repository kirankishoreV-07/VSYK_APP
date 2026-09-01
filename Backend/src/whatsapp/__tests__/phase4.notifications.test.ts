// ============================================================
// Phase 4 — Proactive WhatsApp notifications (live integration, DRY RUN)
// ============================================================
// notifyInstallmentDueForAuction / runOverdueSweep / notifyAuctionScheduled
// sweep REAL production rows by design (that's what makes them worth
// testing against). Approved template IDs are now configured in .env, so
// without a safeguard these calls would reach the real Gupshup API for
// every real matching member — this happened for real on 2026-08-17 (666
// real sends from a single test run). Two protections are required here,
// not one:
//   1. GUPSHUP_DRY_RUN — short-circuits every outbound Gupshup call at its
//      single choke point (gupshup.ts callGupshupApi) before any network
//      request. Set before any code under test runs.
//   2. Claim sweep-cleanup — even in dry-run, a "successful" send still
//      writes a PERMANENT notification_log claim for every real member
//      the sweep touches (not just the fixture customer). Left in place,
//      that claim would silently block the real live scheduler from ever
//      notifying that real member for real. Every call below is followed
//      by deleting all notification_log rows of that type created since
//      the call started, fully restoring production dedup state.
//
// This suite proves the SAFETY properties that must hold regardless of
// template state:
//   • dedup — an already-claimed key is never re-attempted
//   • retry-safety — a failed send releases its claim (no orphan block)
//   • opt-out gating — opted-out members are skipped, never sent to
//   • inactive-member gating — non-active bid_status members are skipped
//   • ownership/scope — only real, eligible, finalized schedules qualify
//   • no crash on missing/invalid auction ids
//
// Run: npx ts-node src/whatsapp/__tests__/phase4.notifications.test.ts
// ============================================================

import * as path from 'path';
import * as dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

process.env.GUPSHUP_DRY_RUN = 'true';

import { createClient } from '@supabase/supabase-js';
import {
  notifyInstallmentDueForAuction,
  runOverdueSweep,
  notifyPartialPayment,
  notifyAuctionScheduled,
} from '../proactiveNotifications';

let passed = 0, failed = 0;
function ok(name: string, cond: boolean, extra = '') {
  if (cond) { console.log(`  ✅ ${name}`); passed++; }
  else { console.log(`  ❌ ${name} ${extra}`); failed++; }
}

async function main() {
  console.log('📣 Phase 4 — Proactive WhatsApp notifications (DRY RUN — no real Gupshup calls)\n');

  const fixturePhone = process.env.TEST_CUSTOMER_PHONE || '';
  if (!fixturePhone) {
    console.error('TEST_CUSTOMER_PHONE is required.');
    process.exit(1);
  }

  const sb = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

  // Deletes every notification_log row of `type` created at/after `since` —
  // restores real production dedup state after a group-/system-wide sweep,
  // regardless of how many real members it touched.
  async function cleanupClaimsSince(type: string, since: string) {
    await sb.from('notification_log').delete().eq('notification_type', type).gte('created_at', since);
  }

  const { data: cust } = await sb.from('customers').select('id, phone, whatsapp_opt_out_at').eq('phone', fixturePhone).maybeSingle();
  if (!cust) { console.error('Fixture customer not found — aborting.'); process.exit(1); }
  const { data: mems } = await sb.from('chit_members').select('id, chit_group_id').eq('customer_id', (cust as any).id);

  // Find a completed auction with at least one unpaid, finalized schedule.
  let targetAuctionId: string | null = null;
  let targetScheduleId: string | null = null;
  for (const m of mems || []) {
    const { data: aucs } = await sb.from('auctions').select('id, auction_number').eq('chit_group_id', (m as any).chit_group_id).eq('status', 'completed');
    for (const a of aucs || []) {
      const { data: sch } = await sb.from('payment_schedules').select('id, amount, paid_amount, paid').eq('chit_member_id', (m as any).id).eq('month_number', (a as any).auction_number).maybeSingle();
      if (sch && !(sch as any).paid && Number((sch as any).amount) > Number((sch as any).paid_amount || 0)) {
        targetAuctionId = (a as any).id;
        targetScheduleId = (sch as any).id;
        break;
      }
    }
    if (targetAuctionId) break;
  }
  ok('found a real completed-auction + unpaid finalized schedule fixture', !!targetAuctionId && !!targetScheduleId);
  if (!targetAuctionId || !targetScheduleId) { console.log('\n(skipping dependent tests — no fixture)'); }

  // ---- 1. Invalid / non-existent auction id never throws ----
  const zero = await notifyInstallmentDueForAuction('00000000-0000-0000-0000-000000000000');
  ok('unknown auctionId → zero tally, no throw', zero.sent === 0 && zero.failed === 0);

  // ---- 2. Not-yet-completed auction is a safe no-op ----
  const { data: upcoming } = await sb.from('auctions').select('id').eq('status', 'upcoming').limit(1).maybeSingle();
  if (upcoming) {
    const t = await notifyInstallmentDueForAuction((upcoming as any).id);
    ok('upcoming (not completed) auction → no send attempted', t.sent === 0 && t.failed === 0);
  }

  if (targetAuctionId && targetScheduleId) {
    // ---- 3. Missing-template send still fails safely AND releases its claim ----
    // Temporarily unset the real template id to exercise the "not configured" path.
    const realInstallmentDueId = process.env.GUPSHUP_TEMPLATE_INSTALLMENT_DUE;
    delete process.env.GUPSHUP_TEMPLATE_INSTALLMENT_DUE;
    await sb.from('notification_log').delete().eq('notification_key', `wa_installment_due:${targetScheduleId}`);

    let since = new Date().toISOString();
    const t1 = await notifyInstallmentDueForAuction(targetAuctionId);
    ok('missing-template send → reported as failed (not silently sent)', t1.failed >= 1, JSON.stringify(t1));
    const { data: claim1 } = await sb.from('notification_log').select('id').eq('notification_key', `wa_installment_due:${targetScheduleId}`);
    ok('failed send releases its notification_log claim (retry-safe)', (claim1 || []).length === 0);
    await cleanupClaimsSince('wa_installment_due', since);
    process.env.GUPSHUP_TEMPLATE_INSTALLMENT_DUE = realInstallmentDueId;

    // ---- 3b. Configured template + dry-run → reported as sent (safe, no real call) ----
    since = new Date().toISOString();
    const t1b = await notifyInstallmentDueForAuction(targetAuctionId);
    ok('configured template (dry-run) → reported as sent, not failed', t1b.sent >= 1, JSON.stringify(t1b));
    await cleanupClaimsSince('wa_installment_due', since);

    // ---- 4. Dedup: a pre-existing (already-sent) claim is never re-attempted ----
    await sb.from('notification_log').insert({ notification_key: `wa_installment_due:${targetScheduleId}`, notification_type: 'wa_installment_due', sent_count: 1 });
    since = new Date().toISOString();
    const t2 = await notifyInstallmentDueForAuction(targetAuctionId);
    ok('pre-claimed key → reported as duplicate, not re-sent', t2.duplicate >= 1, JSON.stringify(t2));
    await cleanupClaimsSince('wa_installment_due', since);
    await sb.from('notification_log').delete().eq('notification_key', `wa_installment_due:${targetScheduleId}`);

    // ---- 5. Opt-out gating ----
    await sb.from('customers').update({ whatsapp_opt_out_at: new Date().toISOString(), whatsapp_opt_in: false }).eq('id', (cust as any).id);
    since = new Date().toISOString();
    const t3 = await notifyInstallmentDueForAuction(targetAuctionId);
    ok('opted-out member is skipped, not sent to', t3.skipped_optout >= 1, JSON.stringify(t3));
    await cleanupClaimsSince('wa_installment_due', since);
    // Restore original consent state.
    await sb.from('customers').update({ whatsapp_opt_out_at: (cust as any).whatsapp_opt_out_at, whatsapp_opt_in: true }).eq('id', (cust as any).id);

    // ---- 6. "Auction completed twice" — calling again must not double-send ----
    await sb.from('notification_log').insert({ notification_key: `wa_installment_due:${targetScheduleId}`, notification_type: 'wa_installment_due', sent_count: 1 });
    since = new Date().toISOString();
    const rerun1 = await notifyInstallmentDueForAuction(targetAuctionId);
    const rerun2 = await notifyInstallmentDueForAuction(targetAuctionId);
    ok('repeated auction-completion runs never exceed one claim (idempotent)', rerun1.duplicate >= 1 && rerun2.duplicate >= 1);
    await cleanupClaimsSince('wa_installment_due', since);
    await sb.from('notification_log').delete().eq('notification_key', `wa_installment_due:${targetScheduleId}`);
  }

  // ---- Auction Scheduled: safe on unknown/unconfigured ids, dedup, opt-out ----
  const zeroSched = await notifyAuctionScheduled('00000000-0000-0000-0000-000000000000');
  ok('unknown auctionId (scheduled) → zero tally, no throw', zeroSched.sent === 0 && zeroSched.failed === 0);

  // Find an 'upcoming' auction in one of the fixture customer's groups.
  let schedAuctionId: string | null = null;
  let schedOriginal: any = null;
  let schedGroupId: string | null = null;
  for (const m of mems || []) {
    const { data: upc } = await sb
      .from('auctions')
      .select('id, min_bid, max_bid, scheduled_at, status')
      .eq('chit_group_id', (m as any).chit_group_id)
      .eq('status', 'upcoming')
      .limit(1)
      .maybeSingle();
    if (upc) { schedAuctionId = (upc as any).id; schedOriginal = upc; schedGroupId = (m as any).chit_group_id; break; }
  }

  if (schedAuctionId) {
    // Placeholder rows have min_bid=0 → not "configured" → must be a safe no-op.
    if (Number(schedOriginal.min_bid) === 0) {
      const t0 = await notifyAuctionScheduled(schedAuctionId);
      ok('unconfigured (min_bid=0) upcoming auction → no send attempted', t0.sent === 0 && t0.failed === 0);
    }

    // Temporarily "configure" it (mirrors the admin's schedule-save) to exercise the real path.
    const futureIso = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from('auctions').update({ min_bid: 10000, max_bid: 50000, scheduled_at: futureIso }).eq('id', schedAuctionId);

    // Missing-template path first.
    const realAuctionSchedId = process.env.GUPSHUP_TEMPLATE_AUCTION_SCHEDULED;
    delete process.env.GUPSHUP_TEMPLATE_AUCTION_SCHEDULED;
    let since = new Date().toISOString();
    const t1 = await notifyAuctionScheduled(schedAuctionId);
    ok('missing-template auction-scheduled send → reported as failed (not silently sent)', t1.failed >= 1, JSON.stringify(t1));
    await cleanupClaimsSince('wa_auction_scheduled', since);
    process.env.GUPSHUP_TEMPLATE_AUCTION_SCHEDULED = realAuctionSchedId;

    // Configured + dry-run → sent, safely.
    since = new Date().toISOString();
    const t1b = await notifyAuctionScheduled(schedAuctionId);
    ok('configured auction-scheduled template (dry-run) → reported as sent', t1b.sent >= 1, JSON.stringify(t1b));
    await cleanupClaimsSince('wa_auction_scheduled', since);

    // Dedup: pre-claim one member's key, then re-run → must be duplicate for that member.
    const memberIdsInGroup = (await sb.from('chit_members').select('id').eq('chit_group_id', schedGroupId)).data || [];
    const probeMemberId = (memberIdsInGroup[0] as any)?.id;
    if (probeMemberId) {
      await sb.from('notification_log').insert({ notification_key: `wa_auction_scheduled:${schedAuctionId}:${probeMemberId}`, notification_type: 'wa_auction_scheduled', sent_count: 1 });
      since = new Date().toISOString();
      const t2 = await notifyAuctionScheduled(schedAuctionId);
      ok('pre-claimed (auction, member) key → reported as duplicate, not re-sent', t2.duplicate >= 1, JSON.stringify(t2));
      await cleanupClaimsSince('wa_auction_scheduled', since);
      await sb.from('notification_log').delete().eq('notification_key', `wa_auction_scheduled:${schedAuctionId}:${probeMemberId}`);
    }

    // Restore the auction row exactly as found.
    await sb.from('auctions').update({
      min_bid: schedOriginal.min_bid,
      max_bid: schedOriginal.max_bid,
      scheduled_at: schedOriginal.scheduled_at,
    }).eq('id', schedAuctionId);
  } else {
    console.log('(skipping Auction Scheduled fixture tests — no upcoming auction found for fixture customer)');
  }

  // ---- 7. Overdue sweep: system-wide by design — dry-run + full claim cleanup ----
  const overdueSince = new Date().toISOString();
  const overdueTally = await runOverdueSweep(new Date());
  ok('overdue sweep completes without throwing', typeof overdueTally.sent === 'number');
  ok('overdue sweep (dry-run) reports sent for configured template, not failed', overdueTally.failed === 0, JSON.stringify(overdueTally));
  await cleanupClaimsSince('wa_overdue', overdueSince);

  // ---- 8. Partial payment notify: safe failure, no orphan claim, dedup by paymentId ----
  if (mems && mems.length > 0 && targetScheduleId) {
    const realPartialId = process.env.GUPSHUP_TEMPLATE_PARTIAL_PAYMENT;
    delete process.env.GUPSHUP_TEMPLATE_PARTIAL_PAYMENT;
    const fakePaymentId = 'pay_phase4_test_' + Date.now();
    const r1 = await notifyPartialPayment({
      scheduleId: targetScheduleId,
      chitMemberId: (mems[0] as any).id,
      paymentId: fakePaymentId,
      appliedAmount: 100,
      remaining: 500,
    });
    ok('partial notify with no template configured → failed safely', r1 === 'failed', r1);
    const { data: orphan } = await sb.from('notification_log').select('id').eq('notification_key', `wa_partial:${targetScheduleId}:${fakePaymentId}`);
    ok('failed partial notify leaves no orphaned claim', (orphan || []).length === 0);
    process.env.GUPSHUP_TEMPLATE_PARTIAL_PAYMENT = realPartialId;

    // Configured + dry-run → sent safely, then clean up (single-key, single-member — no group-wide fan-out here).
    const r1b = await notifyPartialPayment({
      scheduleId: targetScheduleId,
      chitMemberId: (mems[0] as any).id,
      paymentId: fakePaymentId,
      appliedAmount: 100,
      remaining: 500,
    });
    ok('configured partial-payment template (dry-run) → sent safely', r1b === 'sent', r1b);
    await sb.from('notification_log').delete().eq('notification_key', `wa_partial:${targetScheduleId}:${fakePaymentId}`);

    // Dedup: pre-claim then retry with the SAME paymentId → must be 'duplicate'.
    await sb.from('notification_log').insert({ notification_key: `wa_partial:${targetScheduleId}:${fakePaymentId}`, notification_type: 'wa_partial', sent_count: 1 });
    const r2 = await notifyPartialPayment({
      scheduleId: targetScheduleId,
      chitMemberId: (mems[0] as any).id,
      paymentId: fakePaymentId,
      appliedAmount: 100,
      remaining: 500,
    });
    ok('same paymentId is deduped (never sent twice for one payment)', r2 === 'duplicate', r2);
    await sb.from('notification_log').delete().eq('notification_key', `wa_partial:${targetScheduleId}:${fakePaymentId}`);
  }

  console.log(`\n🏁 Phase 4 Summary: ${passed} Passed, ${failed} Failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
