-- ============================================================
-- 025_highest_bid_wins.sql
-- Fix auction logic: highest discount bid wins (not lowest)
-- Add bid retract support and per-member bid revision tracking
-- ============================================================

-- 1. Drop old triggers first
DROP TRIGGER IF EXISTS trg_validate_auction_bid    ON public.auction_bids;
DROP TRIGGER IF EXISTS trg_update_current_lowest_bid ON public.auction_bids;

-- 2. New validation: highest bid wins
--    Rules:
--      - Auction must be live and not expired
--      - bid_amount must be >= min_bid and <= max_bid
--      - bid_amount must be HIGHER than current_bid (highest wins)
--      - member must have joined
--      - member's new bid must be HIGHER than their own last bid (can only revise up)
CREATE OR REPLACE FUNCTION public.validate_auction_bid()
RETURNS TRIGGER AS $$
DECLARE
  a              RECORD;
  my_best_bid    BIGINT;
BEGIN
  SELECT * INTO a FROM public.auctions WHERE id = NEW.auction_id;

  IF a IS NULL THEN
    RAISE EXCEPTION 'Auction not found.';
  END IF;

  IF a.status <> 'live' THEN
    RAISE EXCEPTION 'Auction is not live.';
  END IF;

  IF a.closes_at IS NOT NULL AND now() >= a.closes_at THEN
    RAISE EXCEPTION 'Auction has closed.';
  END IF;

  -- Min/max bid range
  IF NEW.bid_amount < COALESCE(a.min_bid, 0) THEN
    RAISE EXCEPTION 'Bid is below the minimum allowed discount.';
  END IF;

  IF COALESCE(a.max_bid, 0) > 0 AND NEW.bid_amount > a.max_bid THEN
    RAISE EXCEPTION 'Bid exceeds the maximum allowed discount.';
  END IF;

  -- Member must have joined
  IF NEW.customer_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.auction_participants ap
      WHERE ap.auction_id = NEW.auction_id
        AND ap.customer_id = NEW.customer_id
    ) THEN
      RAISE EXCEPTION 'You must join the auction before bidding.';
    END IF;

    -- Member can only revise their bid UPWARD (new bid > their own current best)
    SELECT COALESCE(MAX(bid_amount), 0)
      INTO my_best_bid
      FROM public.auction_bids
     WHERE auction_id = NEW.auction_id
       AND customer_id = NEW.customer_id
       AND is_retracted = FALSE;

    IF NEW.bid_amount <= my_best_bid THEN
      RAISE EXCEPTION 'Your new bid must be higher than your current bid of ₹%.', (my_best_bid / 100);
    END IF;
  END IF;

  -- Auto-fill bidder_name from customers table if not provided
  IF NEW.bidder_name IS NULL AND NEW.customer_id IS NOT NULL THEN
    SELECT full_name INTO NEW.bidder_name FROM public.customers WHERE id = NEW.customer_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_validate_auction_bid
  BEFORE INSERT ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_auction_bid();

-- 3. After insert: update current_bid to track the HIGHEST bid across all members
CREATE OR REPLACE FUNCTION public.update_current_highest_bid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.auctions
     SET current_bid = NEW.bid_amount
   WHERE id = NEW.auction_id
     AND NEW.bid_amount > COALESCE(current_bid, 0);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_current_highest_bid
  AFTER INSERT ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.update_current_highest_bid();

-- 4. Add is_retracted column so members can retract recent bids
ALTER TABLE public.auction_bids
  ADD COLUMN IF NOT EXISTS is_retracted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS retracted_at TIMESTAMPTZ;

-- 5. Index for fast per-member bid lookups
CREATE INDEX IF NOT EXISTS idx_auction_bids_customer_auction
  ON public.auction_bids(auction_id, customer_id);
