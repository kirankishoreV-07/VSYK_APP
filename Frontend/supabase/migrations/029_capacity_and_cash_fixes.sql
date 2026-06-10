-- ============================================================
-- 029_capacity_and_cash_fixes.sql
-- Enforce group capacity on member insert; fix customer cash view
-- ============================================================

-- 1. Enforce capacity based on participation_share totals
CREATE OR REPLACE FUNCTION public.enforce_chit_group_capacity()
RETURNS TRIGGER AS $$
DECLARE
  group_capacity INTEGER;
  existing_shares NUMERIC;
  new_share NUMERIC;
BEGIN
  SELECT COALESCE(capacity, 0)
  INTO group_capacity
  FROM public.chit_groups
  WHERE id = NEW.chit_group_id;

  IF group_capacity IS NULL OR group_capacity <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(participation_share), 0)
  INTO existing_shares
  FROM public.chit_members
  WHERE chit_group_id = NEW.chit_group_id;

  new_share := COALESCE(NEW.participation_share, 1);

  IF existing_shares + new_share > group_capacity THEN
    RAISE EXCEPTION 'Group capacity exceeded (% of % shares filled)', existing_shares, group_capacity
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_chit_group_capacity ON public.chit_members;
CREATE TRIGGER trg_enforce_chit_group_capacity
BEFORE INSERT ON public.chit_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_chit_group_capacity();

-- 2. Customer cash view: members authenticate via customers.id, not auth.uid()
-- Must DROP first: CREATE OR REPLACE cannot insert/rename columns on an existing view.
DROP VIEW IF EXISTS public.v_customer_cash_collections;

CREATE VIEW public.v_customer_cash_collections AS
SELECT
    cc.id,
    cc.chit_member_id,
    cc.month_number,
    cc.amount,
    cc.recorded_at,
    cm.chit_group_id,
    cg.monthly_installment,
    cm.customer_id,
    CASE
        WHEN cc.amount >= cg.monthly_installment THEN 'Full'
        WHEN cc.amount > 0 THEN 'Partial'
        ELSE 'Unpaid'
    END AS payment_status
FROM public.cash_collections cc
JOIN public.chit_members cm ON cm.id = cc.chit_member_id
JOIN public.chit_groups cg ON cg.id = cm.chit_group_id;

-- 3. Demo-friendly read access (matches 017_open_rls_for_demo pattern)
DROP POLICY IF EXISTS "Allow public read cash_collections for demo" ON public.cash_collections;
CREATE POLICY "Allow public read cash_collections for demo"
  ON public.cash_collections FOR SELECT
  USING (true);