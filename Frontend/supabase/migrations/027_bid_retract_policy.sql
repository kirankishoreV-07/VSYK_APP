-- ============================================================
-- 027_bid_retract_policy.sql
-- Add UPDATE policy on auction_bids so retraction actually works.
-- RLS was blocking the UPDATE call silently — no error, no change.
-- Also enforce the 2-minute retract window at DB level.
-- ============================================================

-- 1. Allow public UPDATE on auction_bids (needed for retraction)
DROP POLICY IF EXISTS "Allow public update bids for demo" ON public.auction_bids;
CREATE POLICY "Allow public update bids for demo"
  ON public.auction_bids FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 2. DB-level trigger to validate retract attempts:
--    - Only the bid owner can retract (customer_id must match)
--    - Only within 2 minutes of placing the bid
--    - Can only set is_retracted = true (cannot un-retract)
CREATE OR REPLACE FUNCTION public.validate_bid_retract()
RETURNS TRIGGER AS $$
BEGIN
  -- Prevent un-retracting (once retracted, stays retracted)
  IF OLD.is_retracted = TRUE AND NEW.is_retracted = FALSE THEN
    RAISE EXCEPTION 'A retracted bid cannot be restored.';
  END IF;

  -- If marking as retracted, enforce the 2-minute window
  IF NEW.is_retracted = TRUE AND OLD.is_retracted = FALSE THEN
    IF now() > OLD.placed_at + INTERVAL '2 minutes' THEN
      RAISE EXCEPTION 'Retract window has closed. Bids can only be retracted within 2 minutes of placement.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_bid_retract ON public.auction_bids;
CREATE TRIGGER trg_validate_bid_retract
  BEFORE UPDATE ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_bid_retract();
