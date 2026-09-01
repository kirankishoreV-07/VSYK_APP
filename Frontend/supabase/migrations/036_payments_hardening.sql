-- ============================================================
-- 036_payments_hardening.sql
-- Server-authoritative payments + partial-payment tracking.
--   • payment_schedules.paid_amount  → cumulative verified paise paid
--   • payment_orders                 → order intent + idempotency (service-role only)
-- ============================================================

-- 1. Track cumulative verified amount paid per schedule (paise).
ALTER TABLE public.payment_schedules
  ADD COLUMN IF NOT EXISTS paid_amount BIGINT NOT NULL DEFAULT 0;

-- Backfill: rows already marked fully paid should reflect their full amount.
UPDATE public.payment_schedules
  SET paid_amount = amount
  WHERE paid = true AND paid_amount = 0;

-- 2. Server-created order intents. Binds a Razorpay order to exactly one
--    customer + membership + schedule so verification can enforce ownership
--    and amount, and so duplicate callbacks are idempotent.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id   TEXT NOT NULL UNIQUE,
  customer_id         UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  chit_member_id      UUID NOT NULL REFERENCES public.chit_members(id) ON DELETE CASCADE,
  payment_schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
  month_number        INTEGER,
  amount              BIGINT NOT NULL,            -- requested amount for this order (paise)
  status              TEXT NOT NULL DEFAULT 'created'
                        CHECK (status IN ('created', 'paid', 'failed')),
  razorpay_payment_id TEXT UNIQUE,                -- set on capture; UNIQUE ⇒ no double-credit
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backend uses the service role (bypasses RLS). RLS is enabled with NO policies
-- so the anon key / clients can never read or write order intents.
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payment_orders_schedule ON public.payment_orders(payment_schedule_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_customer ON public.payment_orders(customer_id);

NOTIFY pgrst, 'reload schema';
