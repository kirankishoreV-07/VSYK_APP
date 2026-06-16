-- ============================================================
-- 032_recalc_current_bid_on_retract.sql
-- Make auctions.current_bid recalculation on retract ATOMIC.
--
-- Problem: the client (useRetractBid in app/(tabs)/auctions.tsx) used to
-- recompute current_bid in two round-trips — read the highest remaining
-- active bid, then write it back. Two concurrent retracts, or a retract
-- racing an incoming bid, could interleave and leave current_bid stale
-- (e.g. showing a value that belongs to an already-retracted bid).
--
-- Fix: do the recalculation inside an AFTER UPDATE trigger on auction_bids,
-- in the same transaction as the retract. This mirrors the existing
-- AFTER INSERT trigger trg_update_current_highest_bid (025) and makes the
-- value always consistent regardless of client timing or concurrency.
--
-- The trigger fires only when is_retracted transitions FALSE -> TRUE, then
-- sets current_bid to the MAX of the remaining active bids (or 0 if none).
-- Idempotent (CREATE OR REPLACE + DROP TRIGGER IF EXISTS).
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_current_bid_after_retract()
RETURNS TRIGGER AS $$
DECLARE
  new_highest BIGINT;
BEGIN
  -- Only react when a bid was just retracted.
  IF NEW.is_retracted = TRUE AND COALESCE(OLD.is_retracted, FALSE) = FALSE THEN
    SELECT COALESCE(MAX(bid_amount), 0)
      INTO new_highest
      FROM public.auction_bids
     WHERE auction_id = NEW.auction_id
       AND is_retracted = FALSE;

    UPDATE public.auctions
       SET current_bid = new_highest
     WHERE id = NEW.auction_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalc_current_bid_after_retract ON public.auction_bids;
CREATE TRIGGER trg_recalc_current_bid_after_retract
  AFTER UPDATE ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_current_bid_after_retract();
