-- ============================================================
-- 042_p0_financial_integrity.sql
-- Canonical, atomic payment ledger operations for Razorpay and admin entry.
-- All functions are service-role only; mobile clients cannot execute them.
-- ============================================================

ALTER TABLE public.chit_member_transactions
  ADD COLUMN IF NOT EXISTS payment_schedule_id UUID
    REFERENCES public.payment_schedules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS external_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_transactions_external_payment
  ON public.chit_member_transactions(external_payment_id)
  WHERE external_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_member_transactions_schedule
  ON public.chit_member_transactions(payment_schedule_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_delivery_events (
  message_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  code INTEGER,
  reason TEXT,
  destination_last4 TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_delivery_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.whatsapp_delivery_events FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_delivery_events TO service_role;

-- Every member must have exactly one payable row for a cycle. Historical app
-- versions generated duplicate unpaid schedules. Refuse to guess if any such
-- row contains money, otherwise retain the earliest due row and repoint known
-- references before removing the redundant empty rows.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payment_schedules
    GROUP BY chit_member_id, month_number
    HAVING COUNT(*) > 1
       AND (BOOL_OR(paid) OR SUM(paid_amount) > 0)
  ) THEN
    RAISE EXCEPTION 'Duplicate payment schedules with paid amounts require manual reconciliation';
  END IF;
END;
$$;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY chit_member_id, month_number
           ORDER BY due_date ASC NULLS LAST, id ASC
         ) AS keep_id,
         ROW_NUMBER() OVER (
           PARTITION BY chit_member_id, month_number
           ORDER BY due_date ASC NULLS LAST, id ASC
         ) AS row_number
  FROM public.payment_schedules
)
UPDATE public.payment_orders po
SET payment_schedule_id = r.keep_id, updated_at = NOW()
FROM ranked r
WHERE po.payment_schedule_id = r.id AND r.row_number > 1;

WITH ranked AS (
  SELECT id,
         FIRST_VALUE(id) OVER (
           PARTITION BY chit_member_id, month_number
           ORDER BY due_date ASC NULLS LAST, id ASC
         ) AS keep_id,
         ROW_NUMBER() OVER (
           PARTITION BY chit_member_id, month_number
           ORDER BY due_date ASC NULLS LAST, id ASC
         ) AS row_number
  FROM public.payment_schedules
)
UPDATE public.chit_member_transactions tx
SET payment_schedule_id = r.keep_id
FROM ranked r
WHERE tx.payment_schedule_id = r.id AND r.row_number > 1;

WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY chit_member_id, month_number
           ORDER BY due_date ASC NULLS LAST, id ASC
         ) AS row_number
  FROM public.payment_schedules
)
DELETE FROM public.payment_schedules ps
USING ranked r
WHERE ps.id = r.id AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_schedules_member_month_unique
  ON public.payment_schedules(chit_member_id, month_number);

-- Backfill canonical schedule links for legacy transactions where the auction
-- cycle or the existing "Month N" note identifies exactly one schedule.
UPDATE public.chit_member_transactions tx
SET payment_schedule_id = ps.id
FROM public.auctions a
JOIN public.payment_schedules ps
  ON ps.month_number = a.auction_number
WHERE tx.payment_schedule_id IS NULL
  AND tx.auction_id = a.id
  AND ps.chit_member_id = tx.chit_member_id;

WITH noted_transactions AS (
  SELECT id, chit_member_id,
         (regexp_match(notes, 'Month\s+([0-9]+)', 'i'))[1]::INTEGER AS month_number
  FROM public.chit_member_transactions
  WHERE payment_schedule_id IS NULL
    AND notes ~* 'Month\s+[0-9]+'
)
UPDATE public.chit_member_transactions tx
SET payment_schedule_id = ps.id
FROM noted_transactions nt
JOIN public.payment_schedules ps
  ON ps.chit_member_id = nt.chit_member_id
 AND ps.month_number = nt.month_number
WHERE tx.id = nt.id;

ALTER TABLE public.chit_member_transactions
  DROP CONSTRAINT IF EXISTS chit_member_transactions_payment_type_check;

ALTER TABLE public.chit_member_transactions
  ADD CONSTRAINT chit_member_transactions_payment_type_check
  CHECK (payment_type IN (
    'installment', 'penalty', 'registration', 'dividend', 'prize', 'adjustment', 'refund'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_dividend_per_member_auction
  ON public.chit_member_transactions(chit_member_id, auction_id, payment_type)
  WHERE payment_type = 'dividend';

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_status_check;

ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_status_check
  CHECK (status IN ('created', 'paid', 'failed', 'reconciliation_required'));

-- Only one order may remain payable for a schedule. Creating a replacement
-- invalidates an earlier abandoned order before this index is evaluated.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY payment_schedule_id
           ORDER BY created_at DESC, id DESC
         ) AS row_number
  FROM public.payment_orders
  WHERE status = 'created'
)
UPDATE public.payment_orders po
SET status = 'failed', updated_at = NOW()
FROM ranked r
WHERE po.id = r.id AND r.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_one_open_per_schedule
  ON public.payment_orders(payment_schedule_id)
  WHERE status = 'created';

CREATE OR REPLACE FUNCTION public.register_payment_order(
  p_razorpay_order_id TEXT,
  p_customer_id UUID,
  p_chit_member_id UUID,
  p_payment_schedule_id UUID,
  p_month_number INTEGER,
  p_amount BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_valid BOOLEAN;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment order amount must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_payment_schedule_id::TEXT, 0));

  SELECT EXISTS (
    SELECT 1
    FROM public.payment_schedules ps
    JOIN public.chit_members cm ON cm.id = ps.chit_member_id
    WHERE ps.id = p_payment_schedule_id
      AND ps.chit_member_id = p_chit_member_id
      AND cm.customer_id = p_customer_id
      AND ps.paid = FALSE
      AND GREATEST(ps.amount - ps.paid_amount, 0) >= p_amount
  ) INTO v_valid;

  IF NOT v_valid THEN
    RAISE EXCEPTION 'Payment schedule is no longer payable';
  END IF;

  UPDATE public.payment_orders
  SET status = 'failed', updated_at = NOW()
  WHERE payment_schedule_id = p_payment_schedule_id
    AND status = 'created';

  INSERT INTO public.payment_orders (
    razorpay_order_id, customer_id, chit_member_id, payment_schedule_id,
    month_number, amount, status
  ) VALUES (
    p_razorpay_order_id, p_customer_id, p_chit_member_id,
    p_payment_schedule_id, p_month_number, p_amount, 'created'
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_verified_payment(
  p_razorpay_order_id TEXT,
  p_razorpay_payment_id TEXT,
  p_customer_id UUID,
  p_captured_amount BIGINT
)
RETURNS TABLE (
  result_status TEXT,
  fully_paid BOOLEAN,
  paid_amount BIGINT,
  remaining BIGINT,
  applied_amount BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.payment_orders%ROWTYPE;
  v_schedule public.payment_schedules%ROWTYPE;
  v_remaining BIGINT;
  v_new_paid BIGINT;
BEGIN
  SELECT * INTO v_order
  FROM public.payment_orders
  WHERE razorpay_order_id = p_razorpay_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment order not found';
  END IF;
  IF v_order.customer_id <> p_customer_id THEN
    RAISE EXCEPTION 'Not authorized for this payment order';
  END IF;

  SELECT * INTO v_schedule
  FROM public.payment_schedules
  WHERE id = v_order.payment_schedule_id
  FOR UPDATE;

  IF NOT FOUND OR v_schedule.chit_member_id <> v_order.chit_member_id THEN
    RAISE EXCEPTION 'Payment schedule does not match order';
  END IF;

  v_remaining := GREATEST(v_schedule.amount - v_schedule.paid_amount, 0);

  IF v_order.status = 'paid' THEN
    IF v_order.razorpay_payment_id IS DISTINCT FROM p_razorpay_payment_id THEN
      RAISE EXCEPTION 'Payment order was already consumed by another payment';
    END IF;
    RETURN QUERY SELECT
      'already_processed'::TEXT,
      v_schedule.paid,
      v_schedule.paid_amount,
      v_remaining,
      0::BIGINT;
    RETURN;
  END IF;

  -- An invalidated/failed order that later captures, a provider amount
  -- mismatch, or a changed schedule balance needs human reconciliation.
  IF v_order.status <> 'created'
     OR p_captured_amount <> v_order.amount
     OR p_captured_amount <= 0
     OR p_captured_amount > v_remaining THEN
    UPDATE public.payment_orders
    SET status = 'reconciliation_required',
        razorpay_payment_id = p_razorpay_payment_id,
        updated_at = NOW()
    WHERE id = v_order.id;

    RETURN QUERY SELECT
      'reconciliation_required'::TEXT,
      v_schedule.paid,
      v_schedule.paid_amount,
      v_remaining,
      0::BIGINT;
    RETURN;
  END IF;

  v_new_paid := v_schedule.paid_amount + p_captured_amount;

  UPDATE public.payment_schedules
  SET paid_amount = v_new_paid,
      paid = (v_new_paid >= amount),
      paid_at = CASE WHEN v_new_paid >= amount THEN NOW() ELSE paid_at END
  WHERE id = v_schedule.id;

  INSERT INTO public.chit_member_transactions (
    chit_member_id, auction_id, payment_schedule_id, amount,
    payment_type, payment_method, external_payment_id, status, notes
  ) VALUES (
    v_schedule.chit_member_id,
    NULL,
    v_schedule.id,
    p_captured_amount,
    'installment',
    'razorpay',
    p_razorpay_payment_id,
    'completed',
    'Month ' || v_schedule.month_number || ' - Razorpay: ' || p_razorpay_payment_id
  );

  UPDATE public.payment_orders
  SET status = 'paid',
      razorpay_payment_id = p_razorpay_payment_id,
      updated_at = NOW()
  WHERE id = v_order.id;

  RETURN QUERY SELECT
    'applied'::TEXT,
    (v_new_paid >= v_schedule.amount),
    v_new_paid,
    GREATEST(v_schedule.amount - v_new_paid, 0),
    p_captured_amount;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_admin_installment_payment(
  p_chit_member_id UUID,
  p_auction_id UUID,
  p_amount BIGINT,
  p_payment_method TEXT,
  p_notes TEXT,
  p_recorded_by UUID
)
RETURNS TABLE (
  fully_paid BOOLEAN,
  paid_amount BIGINT,
  remaining BIGINT,
  applied_amount BIGINT,
  payment_schedule_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction public.auctions%ROWTYPE;
  v_schedule public.payment_schedules%ROWTYPE;
  v_new_paid BIGINT;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  SELECT * INTO v_auction FROM public.auctions WHERE id = p_auction_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;

  SELECT ps.* INTO v_schedule
  FROM public.payment_schedules ps
  JOIN public.chit_members cm ON cm.id = ps.chit_member_id
  WHERE ps.chit_member_id = p_chit_member_id
    AND ps.month_number = v_auction.auction_number
    AND cm.chit_group_id = v_auction.chit_group_id
  FOR UPDATE OF ps;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment schedule not found for this auction cycle';
  END IF;
  IF p_amount > GREATEST(v_schedule.amount - v_schedule.paid_amount, 0) THEN
    RAISE EXCEPTION 'Payment exceeds the remaining installment balance';
  END IF;

  v_new_paid := v_schedule.paid_amount + p_amount;

  UPDATE public.payment_schedules
  SET paid_amount = v_new_paid,
      paid = (v_new_paid >= amount),
      paid_at = CASE WHEN v_new_paid >= amount THEN NOW() ELSE paid_at END
  WHERE id = v_schedule.id;

  INSERT INTO public.chit_member_transactions (
    chit_member_id, auction_id, payment_schedule_id, amount,
    payment_type, payment_method, recorded_by, status, notes
  ) VALUES (
    p_chit_member_id, p_auction_id, v_schedule.id, p_amount,
    'installment', COALESCE(NULLIF(p_payment_method, ''), 'manual'),
    p_recorded_by, 'completed', p_notes
  );

  RETURN QUERY SELECT
    (v_new_paid >= v_schedule.amount),
    v_new_paid,
    GREATEST(v_schedule.amount - v_new_paid, 0),
    p_amount,
    v_schedule.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_auction_settlement(
  p_auction_id UUID,
  p_winner_member_id UUID,
  p_winner_name TEXT,
  p_current_bid BIGINT,
  p_installment_due BIGINT,
  p_dividend_amount BIGINT,
  p_discount_amount BIGINT,
  p_final_due_amount BIGINT,
  p_winner_prize_amount BIGINT
)
RETURNS TABLE (updated_members INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction public.auctions%ROWTYPE;
  v_member RECORD;
  v_target_amount BIGINT;
  v_target_dividend BIGINT;
  v_count INTEGER := 0;
BEGIN
  IF p_current_bid < 0 OR p_installment_due < 0 OR p_dividend_amount < 0
     OR p_discount_amount < 0 OR p_final_due_amount < 0
     OR p_winner_prize_amount < 0 THEN
    RAISE EXCEPTION 'Settlement amounts cannot be negative';
  END IF;

  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;
  IF v_auction.auction_number IS NULL OR v_auction.auction_number < 1 THEN
    RAISE EXCEPTION 'Auction cycle is invalid';
  END IF;
  IF p_winner_member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.chit_members
    WHERE id = p_winner_member_id
      AND chit_group_id = v_auction.chit_group_id
  ) THEN
    RAISE EXCEPTION 'Winner does not belong to this chit group';
  END IF;

  -- Lock the group cycle so concurrent scheduler/admin settlement calls cannot
  -- interleave their schedule updates.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_auction.chit_group_id::TEXT || ':' || v_auction.auction_number::TEXT, 0)
  );

  -- Refuse a correction that would make a member's verified paid amount
  -- greater than the newly calculated obligation.
  IF EXISTS (
    SELECT 1
    FROM public.payment_schedules ps
    JOIN public.chit_members cm ON cm.id = ps.chit_member_id
    WHERE cm.chit_group_id = v_auction.chit_group_id
      AND ps.month_number = v_auction.auction_number
      AND ps.paid_amount > ROUND(p_final_due_amount * COALESCE(cm.participation_share, 1))
  ) THEN
    RAISE EXCEPTION 'Settlement would reduce a due below an amount already paid';
  END IF;

  UPDATE public.auctions
  SET status = 'completed',
      winner_member_id = p_winner_member_id,
      winner_name = NULLIF(BTRIM(p_winner_name), ''),
      current_bid = p_current_bid,
      installment_due = p_installment_due,
      dividend_amount = p_dividend_amount,
      discount_amount = p_discount_amount,
      final_due_amount = p_final_due_amount,
      winner_prize_amount = p_winner_prize_amount,
      ended_at = COALESCE(ended_at, NOW())
  WHERE id = p_auction_id;

  FOR v_member IN
    SELECT id, COALESCE(participation_share, 1) AS participation_share
    FROM public.chit_members
    WHERE chit_group_id = v_auction.chit_group_id
    FOR UPDATE
  LOOP
    v_target_amount := ROUND(p_final_due_amount * v_member.participation_share);
    v_target_dividend := ROUND(p_dividend_amount * v_member.participation_share);

    INSERT INTO public.payment_schedules (
      chit_member_id, month_number, due_date, amount, paid_amount,
      paid, paid_at, dividend_amount
    ) VALUES (
      v_member.id, v_auction.auction_number, CURRENT_DATE + 7,
      v_target_amount, 0, (v_target_amount = 0),
      CASE WHEN v_target_amount = 0 THEN NOW() ELSE NULL END,
      v_target_dividend
    )
    ON CONFLICT (chit_member_id, month_number) DO UPDATE
    SET amount = EXCLUDED.amount,
        dividend_amount = EXCLUDED.dividend_amount,
        paid = (public.payment_schedules.paid_amount >= EXCLUDED.amount),
        paid_at = CASE
          WHEN public.payment_schedules.paid_amount >= EXCLUDED.amount
            THEN COALESCE(public.payment_schedules.paid_at, NOW())
          ELSE NULL
        END;

    IF v_target_dividend > 0 THEN
      INSERT INTO public.chit_member_transactions (
        chit_member_id, auction_id, payment_schedule_id, amount,
        payment_type, payment_method, status, notes
      ) VALUES (
        v_member.id, p_auction_id,
        (SELECT id FROM public.payment_schedules
         WHERE chit_member_id = v_member.id AND month_number = v_auction.auction_number),
        v_target_dividend, 'dividend', 'auction_settlement', 'completed',
        'Auction dividend credit (Cycle ' || v_auction.auction_number || ')'
      )
      ON CONFLICT (chit_member_id, auction_id, payment_type)
        WHERE payment_type = 'dividend'
      DO UPDATE SET
        amount = EXCLUDED.amount,
        payment_schedule_id = EXCLUDED.payment_schedule_id,
        transaction_date = NOW();
    ELSE
      DELETE FROM public.chit_member_transactions
      WHERE chit_member_id = v_member.id
        AND auction_id = p_auction_id
        AND payment_type = 'dividend';
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_prize_payout(
  p_auction_id UUID,
  p_chit_member_id UUID,
  p_amount BIGINT,
  p_notes TEXT,
  p_denomination_500 INTEGER,
  p_denomination_200 INTEGER,
  p_denomination_100 INTEGER,
  p_denomination_50 INTEGER,
  p_denomination_20 INTEGER,
  p_denomination_10 INTEGER,
  p_recorded_by UUID
)
RETURNS TABLE (settlement_id UUID, total_settled BIGINT, remaining BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction public.auctions%ROWTYPE;
  v_already_settled BIGINT;
  v_settlement_id UUID;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Prize payout amount must be positive';
  END IF;
  IF LEAST(
    p_denomination_500, p_denomination_200, p_denomination_100,
    p_denomination_50, p_denomination_20, p_denomination_10
  ) < 0 THEN
    RAISE EXCEPTION 'Denomination counts cannot be negative';
  END IF;

  SELECT * INTO v_auction
  FROM public.auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;
  IF v_auction.status <> 'completed' OR v_auction.winner_member_id IS DISTINCT FROM p_chit_member_id THEN
    RAISE EXCEPTION 'Prize recipient is not the completed auction winner';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_already_settled
  FROM public.auction_prize_settlements
  WHERE auction_id = p_auction_id;

  IF v_already_settled + p_amount > COALESCE(v_auction.winner_prize_amount, 0) THEN
    RAISE EXCEPTION 'Prize payout exceeds the remaining winner prize';
  END IF;

  INSERT INTO public.auction_prize_settlements (
    auction_id, chit_member_id, amount, notes,
    denomination_500, denomination_200, denomination_100,
    denomination_50, denomination_20, denomination_10, recorded_by
  ) VALUES (
    p_auction_id, p_chit_member_id, p_amount, NULLIF(BTRIM(p_notes), ''),
    p_denomination_500, p_denomination_200, p_denomination_100,
    p_denomination_50, p_denomination_20, p_denomination_10, p_recorded_by
  ) RETURNING id INTO v_settlement_id;

  INSERT INTO public.chit_member_transactions (
    chit_member_id, auction_id, amount, payment_type, payment_method,
    recorded_by, status, notes
  ) VALUES (
    p_chit_member_id, p_auction_id, p_amount, 'prize',
    CASE
      WHEN p_denomination_500 + p_denomination_200 + p_denomination_100
         + p_denomination_50 + p_denomination_20 + p_denomination_10 > 0
        THEN 'cash'
      ELSE 'manual'
    END,
    p_recorded_by, 'completed',
    'Auction Prize Payout (Cycle ' || v_auction.auction_number || ')'
  );

  RETURN QUERY SELECT
    v_settlement_id,
    v_already_settled + p_amount,
    GREATEST(COALESCE(v_auction.winner_prize_amount, 0) - v_already_settled - p_amount, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.register_payment_order(TEXT, UUID, UUID, UUID, INTEGER, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_verified_payment(TEXT, TEXT, UUID, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_admin_installment_payment(UUID, UUID, BIGINT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_auction_settlement(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_prize_payout(UUID, UUID, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_payment_order(TEXT, UUID, UUID, UUID, INTEGER, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_verified_payment(TEXT, TEXT, UUID, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_admin_installment_payment(UUID, UUID, BIGINT, TEXT, TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_auction_settlement(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_prize_payout(UUID, UUID, BIGINT, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, UUID) TO service_role;

NOTIFY pgrst, 'reload schema';
