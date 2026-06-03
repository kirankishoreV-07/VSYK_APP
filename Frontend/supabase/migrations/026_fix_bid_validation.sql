-- ============================================================
-- 026_fix_bid_validation.sql
-- Fix bid validation: a member must beat the GLOBAL highest bid,
-- not just their own previous bid.
--
-- Correct rules:
--   1. Auction must be live and not expired
--   2. bid_amount >= min_bid AND <= max_bid
--   3. bid_amount > auctions.current_bid  (beat the global leader)
--   4. Member must have joined
--   5. No restriction based on own previous bid — they can bid any
--      amount above the global floor, even if it's lower than what
--      they bid before (because retract resets their position)
-- ============================================================

DROP TRIGGER IF EXISTS trg_validate_auction_bid ON public.auction_bids;

CREATE OR REPLACE FUNCTION public.validate_auction_bid()
RETURNS TRIGGER AS $$
DECLARE
  a RECORD;
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

  -- Range validation
  IF NEW.bid_amount < COALESCE(a.min_bid, 0) THEN
    RAISE EXCEPTION 'Bid is below the minimum allowed discount of ₹%.', (COALESCE(a.min_bid, 0) / 100);
  END IF;

  IF COALESCE(a.max_bid, 0) > 0 AND NEW.bid_amount > a.max_bid THEN
    RAISE EXCEPTION 'Bid exceeds the maximum allowed discount of ₹%.', (a.max_bid / 100);
  END IF;

  -- Must beat the GLOBAL current highest bid
  -- (current_bid = 0 means no bids yet — any valid amount is accepted)
  IF COALESCE(a.current_bid, 0) > 0 AND NEW.bid_amount <= a.current_bid THEN
    RAISE EXCEPTION 'Your bid of ₹% must be higher than the current highest bid of ₹%.',
      (NEW.bid_amount / 100), (a.current_bid / 100);
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
  END IF;

  -- Auto-fill bidder_name
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
