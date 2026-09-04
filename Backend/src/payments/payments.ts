// ============================================================
// Server-authoritative Razorpay payments (Phase 3)
// ============================================================
// The mobile client NEVER decides payment state. It only forwards
// Razorpay's signed tokens; the backend verifies the signature,
// re-fetches the payment from Razorpay to confirm it was captured
// for the expected amount, then records it idempotently.
//
//   POST /api/payments/razorpay/order   { paymentScheduleId, amount? }
//   POST /api/payments/razorpay/verify  { orderId, paymentId, signature }
//
// All secrets stay server-side. Ownership is enforced from the
// authenticated session (Supabase JWT → customer_id), never from
// client-supplied member/schedule ids alone.
// ============================================================

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { notifyPartialPayment } from '../whatsapp/proactiveNotifications';
import { requireAdminAuth } from '../middleware/adminAuth';

// ── Pure application logic (unit-tested offline) ──────────────

export interface PaymentApplication {
  appliedAmount: number; // paise actually applied to the schedule (capped at remaining)
  newPaidAmount: number; // schedule.paid_amount after applying (never exceeds due)
  remaining: number;     // due - newPaidAmount (never < 0)
  fullyPaid: boolean;    // remaining === 0
  isPartial: boolean;    // applied > 0 but not fully paid
  overpaid: number;      // paise beyond what was owed (not credited to the schedule)
}

/**
 * Apply an incoming verified payment to a schedule's running balance.
 * Caps at the amount due so paid_amount never exceeds the obligation and
 * `remaining` is never negative. Overpayment is reported separately.
 */
export function applyPayment(due: number, currentPaid: number, incoming: number): PaymentApplication {
  const safeDue = Math.max(0, Math.round(due));
  const safePaid = Math.max(0, Math.round(currentPaid));
  const safeIncoming = Math.max(0, Math.round(incoming));

  const owed = Math.max(0, safeDue - safePaid);
  const appliedAmount = Math.min(safeIncoming, owed);
  const newPaidAmount = safePaid + appliedAmount;
  const remaining = Math.max(0, safeDue - newPaidAmount);
  const fullyPaid = remaining === 0;

  return {
    appliedAmount,
    newPaidAmount,
    remaining,
    fullyPaid,
    isPartial: appliedAmount > 0 && !fullyPaid,
    overpaid: safeIncoming - appliedAmount,
  };
}

export interface CapturedPaymentValidation {
  ok: boolean;
  capturedAmount: number;
  reconciliationRequired: boolean;
  error?: string;
}

/** Validate the provider record independently of any client-submitted amount. */
export function validateCapturedPayment(
  payment: any,
  expectedOrderId: string,
  expectedAmount: number,
): CapturedPaymentValidation {
  if (!payment || payment.order_id !== expectedOrderId) {
    return { ok: false, capturedAmount: 0, reconciliationRequired: false, error: 'Payment does not match order.' };
  }
  if (payment.status !== 'captured') {
    return { ok: false, capturedAmount: 0, reconciliationRequired: false, error: 'Payment not captured.' };
  }
  if (String(payment.currency || '').toUpperCase() !== 'INR') {
    return { ok: false, capturedAmount: 0, reconciliationRequired: false, error: 'Unexpected payment currency.' };
  }

  const capturedAmount = Number(payment.amount);
  if (!Number.isSafeInteger(capturedAmount) || capturedAmount <= 0 || capturedAmount !== expectedAmount) {
    return {
      ok: true,
      capturedAmount: Number.isFinite(capturedAmount) ? capturedAmount : 0,
      reconciliationRequired: true,
      error: 'Captured amount does not match the payment order.',
    };
  }
  return { ok: true, capturedAmount, reconciliationRequired: false };
}

// ── Config ────────────────────────────────────────────────────

const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';

let _razorpay: Razorpay | null = null;
function getRazorpay(): Razorpay | null {
  if (_razorpay) return _razorpay;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return null;
  _razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
  return _razorpay;
}

let _admin: SupabaseClient | null = null;
function getAdmin(): SupabaseClient | null {
  if (_admin) return _admin;
  const url = process.env.SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) return null;
  _admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return _admin;
}

// ── Auth: resolve the caller's customer from the Supabase JWT ──

interface AuthedCustomer { customerId: string; }

async function getAuthedCustomer(req: Request): Promise<AuthedCustomer | null> {
  const admin = getAdmin();
  if (!admin) return null;
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return null;

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  const customerId = (data.user.user_metadata as any)?.customer_id as string | undefined;
  if (!customerId) return null;
  return { customerId };
}

// ── Router ────────────────────────────────────────────────────

export const paymentsRouter = Router();

/**
 * Create a Razorpay order bound to one of the CALLER's own schedules.
 * The amount is derived server-side from the real remaining balance;
 * a client-supplied amount can only be a partial ≤ remaining.
 */
paymentsRouter.post('/razorpay/order', async (req: Request, res: Response) => {
  try {
    const razorpay = getRazorpay();
    const admin = getAdmin();
    if (!razorpay || !admin) return res.status(500).json({ error: 'Payments not configured.' });

    const authed = await getAuthedCustomer(req);
    if (!authed) return res.status(401).json({ error: 'Authentication required.' });

    const { paymentScheduleId, amount } = req.body ?? {};
    if (!paymentScheduleId) return res.status(400).json({ error: 'paymentScheduleId is required.' });

    // Load the schedule + its membership; enforce ownership from the session.
    const { data: schedule, error: schErr } = await admin
      .from('payment_schedules')
      .select('id, chit_member_id, month_number, amount, paid_amount, paid, chit_members ( customer_id )')
      .eq('id', paymentScheduleId)
      .maybeSingle();

    if (schErr) return res.status(500).json({ error: 'Could not load schedule.' });
    if (!schedule) return res.status(404).json({ error: 'Schedule not found.' });

    const ownerCustomerId = (schedule as any).chit_members?.customer_id;
    if (ownerCustomerId !== authed.customerId) {
      // IDOR guard: never let a member pay/inspect another member's schedule.
      return res.status(403).json({ error: 'Not authorized for this schedule.' });
    }

    const due = Number((schedule as any).amount || 0);
    const paidAmount = Number((schedule as any).paid_amount || 0);
    const remaining = Math.max(0, due - paidAmount);
    if (remaining <= 0 || (schedule as any).paid) {
      return res.status(400).json({ error: 'This installment is already fully paid.' });
    }

    // Optional partial: clamp any client amount into [1, remaining].
    let payAmount = remaining;
    if (amount !== undefined && amount !== null) {
      const req2 = Math.round(Number(amount));
      if (!Number.isSafeInteger(req2) || req2 <= 0) return res.status(400).json({ error: 'Invalid amount.' });
      payAmount = Math.min(req2, remaining);
    }

    const order = await razorpay.orders.create({
      amount: payAmount,
      currency: 'INR',
      receipt: `sch-${paymentScheduleId}`.slice(0, 40),
      notes: { paymentScheduleId, customerId: authed.customerId },
    });

    const { error: insErr } = await admin.rpc('register_payment_order', {
      p_razorpay_order_id: order.id,
      p_customer_id: authed.customerId,
      p_chit_member_id: (schedule as any).chit_member_id,
      p_payment_schedule_id: (schedule as any).id,
      p_month_number: (schedule as any).month_number,
      p_amount: payAmount,
    });
    if (insErr) {
      console.error('[Payments] order persist failed:', insErr.message);
      return res.status(500).json({ error: 'Could not create order.' });
    }

    return res.json({ id: order.id, amount: payAmount, currency: 'INR', keyId: RAZORPAY_KEY_ID });
  } catch (error: any) {
    console.error('[Payments] order error:', error?.message || error);
    return res.status(500).json({ error: 'Failed to create order.' });
  }
});

/**
 * Verify a Razorpay payment and record it — the ONLY path that can change
 * payment state. Idempotent: a duplicate/out-of-order callback for an
 * already-processed order returns the current state without double-crediting.
 */
paymentsRouter.post('/razorpay/verify', async (req: Request, res: Response) => {
  try {
    const razorpay = getRazorpay();
    const admin = getAdmin();
    if (!razorpay || !admin || !RAZORPAY_KEY_SECRET) {
      return res.status(500).json({ error: 'Payments not configured.' });
    }

    const authed = await getAuthedCustomer(req);
    if (!authed) return res.status(401).json({ error: 'Authentication required.' });

    const { orderId, paymentId, signature } = req.body ?? {};
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing verification fields.' });
    }

    // 1. Signature check (client cannot forge without the secret).
    const expected = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    if (expected !== signature) {
      return res.status(400).json({ verified: false, error: 'Invalid signature.' });
    }

    // 2. Load our order intent; enforce ownership.
    const { data: order, error: ordErr } = await admin
      .from('payment_orders')
      .select('id, customer_id, chit_member_id, payment_schedule_id, month_number, amount, status, razorpay_payment_id')
      .eq('razorpay_order_id', orderId)
      .maybeSingle();
    if (ordErr) return res.status(500).json({ error: 'Could not load order.' });
    if (!order) return res.status(404).json({ error: 'Order not found.' });
    if ((order as any).customer_id !== authed.customerId) {
      return res.status(403).json({ error: 'Not authorized for this order.' });
    }

    // 3. Idempotency: already processed → return current state, no re-credit.
    if ((order as any).status === 'paid') {
      if ((order as any).razorpay_payment_id !== paymentId) {
        return res.status(409).json({ verified: false, error: 'This order was already paid using another payment.' });
      }
      const { data: sch } = await admin
        .from('payment_schedules')
        .select('amount, paid_amount, paid')
        .eq('id', (order as any).payment_schedule_id)
        .maybeSingle();
      const due = Number((sch as any)?.amount || 0);
      const paid = Number((sch as any)?.paid_amount || 0);
      return res.json({ verified: true, alreadyProcessed: true, fullyPaid: !!(sch as any)?.paid, paidAmount: paid, remaining: Math.max(0, due - paid) });
    }

    // 4. Re-fetch the payment from Razorpay — trust Razorpay, not the client.
    const payment: any = await razorpay.payments.fetch(paymentId);
    const validation = validateCapturedPayment(payment, orderId, Number((order as any).amount || 0));
    if (!validation.ok) {
      if (validation.error === 'Payment not captured.') {
      await admin.from('payment_orders').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('id', (order as any).id);
      }
      return res.status(400).json({ verified: false, error: validation.error });
    }
    const capturedAmount = validation.capturedAmount;

    // 5. Lock the order + schedule and apply every ledger change in one DB
    // transaction. The RPC also rechecks the expected captured amount.
    const { data: applyRows, error: applyErr } = await admin.rpc('apply_verified_payment', {
      p_razorpay_order_id: orderId,
      p_razorpay_payment_id: paymentId,
      p_customer_id: authed.customerId,
      p_captured_amount: capturedAmount,
    });
    if (applyErr) {
      console.error('[Payments] atomic apply failed:', applyErr.message);
      return res.status(500).json({ error: 'Could not record payment safely.' });
    }

    const result: any = Array.isArray(applyRows) ? applyRows[0] : applyRows;
    if (!result) return res.status(500).json({ error: 'Payment update returned no result.' });
    if (result.result_status === 'reconciliation_required') {
      return res.status(409).json({
        verified: false,
        reconciliationRequired: true,
        error: 'Payment captured but needs reconciliation. Please contact support and do not pay again.',
      });
    }

    // Only PARTIAL payments trigger a WhatsApp notification — full payment
    // sends NO generic success message (by design). Deduped per
    // (schedule, paymentId) so a retried/duplicate verify call can never
    // send this twice for the same Razorpay payment.
    const isPartial = Number(result.applied_amount || 0) > 0 && !result.fully_paid;
    if (isPartial && result.result_status === 'applied') {
      notifyPartialPayment({
        scheduleId: (order as any).payment_schedule_id,
        chitMemberId: (order as any).chit_member_id,
        paymentId,
        appliedAmount: Number(result.applied_amount),
        remaining: result.remaining,
      }).catch((e: any) => console.error('[Payments] partial notify error:', e?.message));
    }

    return res.json({
      verified: true,
      alreadyProcessed: result.result_status === 'already_processed',
      fullyPaid: result.fully_paid,
      partial: isPartial,
      appliedAmount: Number(result.applied_amount || 0),
      paidAmount: Number(result.paid_amount || 0),
      remaining: result.remaining,
    });
  } catch (error: any) {
    console.error('[Payments] verify error:', error?.message || error);
    return res.status(500).json({ error: 'Could not verify payment.' });
  }
});

/** Record an accounted installment received by an admin. The DB resolves the
 * auction cycle's schedule and writes the balance + ledger row atomically. */
paymentsRouter.post('/admin/record', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = getAdmin();
    if (!admin) return res.status(500).json({ error: 'Payments not configured.' });

    const { chitMemberId, auctionId, amount, paymentMethod, notes } = req.body ?? {};
    const amountPaise = Math.round(Number(amount));
    if (!chitMemberId || !auctionId) {
      return res.status(400).json({ error: 'Member and auction are required.' });
    }
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'Enter a valid payment amount.' });
    }

    const { data, error } = await admin.rpc('record_admin_installment_payment', {
      p_chit_member_id: chitMemberId,
      p_auction_id: auctionId,
      p_amount: amountPaise,
      p_payment_method: String(paymentMethod || 'manual'),
      p_notes: notes ? String(notes).trim().slice(0, 500) : null,
      p_recorded_by: res.locals.adminUserId,
    });
    if (error) {
      const message = error.message || 'Could not record payment.';
      const isInputError = /not found|exceeds|positive/i.test(message);
      return res.status(isInputError ? 400 : 500).json({ error: message });
    }

    const result: any = Array.isArray(data) ? data[0] : data;
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[Payments] admin record error:', error?.message || error);
    return res.status(500).json({ error: 'Could not record payment.' });
  }
});

/** Record the winner payout and its ledger row in the same transaction. */
paymentsRouter.post('/admin/prize-payout', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    const admin = getAdmin();
    if (!admin) return res.status(500).json({ error: 'Payments not configured.' });

    const { auctionId, chitMemberId, amount, notes, denominations } = req.body ?? {};
    const amountPaise = Math.round(Number(amount));
    if (!auctionId || !chitMemberId) {
      return res.status(400).json({ error: 'Auction and winner are required.' });
    }
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ error: 'Enter a valid prize payout amount.' });
    }

    const denomination = (value: unknown) => Math.round(Number(value || 0));
    const denoms = {
      d500: denomination(denominations?.[500]),
      d200: denomination(denominations?.[200]),
      d100: denomination(denominations?.[100]),
      d50: denomination(denominations?.[50]),
      d20: denomination(denominations?.[20]),
      d10: denomination(denominations?.[10]),
    };
    if (Object.values(denoms).some((value) => !Number.isSafeInteger(value) || value < 0)) {
      return res.status(400).json({ error: 'Invalid denomination count.' });
    }

    const { data, error } = await admin.rpc('record_prize_payout', {
      p_auction_id: auctionId,
      p_chit_member_id: chitMemberId,
      p_amount: amountPaise,
      p_notes: notes ? String(notes).trim().slice(0, 500) : null,
      p_denomination_500: denoms.d500,
      p_denomination_200: denoms.d200,
      p_denomination_100: denoms.d100,
      p_denomination_50: denoms.d50,
      p_denomination_20: denoms.d20,
      p_denomination_10: denoms.d10,
      p_recorded_by: res.locals.adminUserId,
    });
    if (error) {
      const message = error.message || 'Could not record prize payout.';
      return res.status(/not found|winner|exceeds|positive|negative/i.test(message) ? 400 : 500).json({ error: message });
    }

    const result: any = Array.isArray(data) ? data[0] : data;
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error('[Payments] prize payout error:', error?.message || error);
    return res.status(500).json({ error: 'Could not record prize payout.' });
  }
});
