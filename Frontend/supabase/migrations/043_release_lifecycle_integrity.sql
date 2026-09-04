-- Release lifecycle integrity: explicit group activation, race-safe tickets and
-- bids, auditable commission, and one-shot auction finalization.

ALTER TABLE public.chit_groups
  DROP CONSTRAINT IF EXISTS chit_groups_status_check;
ALTER TABLE public.chit_groups
  ADD CONSTRAINT chit_groups_status_check
  CHECK (status IN ('draft', 'active', 'completed', 'cancelled'));

ALTER TABLE public.auctions
  ADD COLUMN IF NOT EXISTS commission_amount BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Serialize enrollment within a group so concurrent inserts cannot receive
  -- the same MAX(ticket_number) + 1 value.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.chit_group_id::TEXT, 0));
  SELECT COALESCE(MAX(ticket_number), 0) + 1
    INTO NEW.ticket_number
    FROM public.chit_members
   WHERE chit_group_id = NEW.chit_group_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_auction_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  a RECORD;
BEGIN
  -- Make the read/check/update sequence for one auction serial. Without this,
  -- simultaneous equal bids could both validate against the same stale value.
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.auction_id::TEXT, 0));
  SELECT * INTO a FROM public.auctions WHERE id = NEW.auction_id;

  IF a IS NULL THEN RAISE EXCEPTION 'Auction not found.'; END IF;
  IF a.status <> 'live' THEN RAISE EXCEPTION 'Auction is not live.'; END IF;
  IF a.closes_at IS NOT NULL AND NOW() >= a.closes_at THEN
    RAISE EXCEPTION 'Auction has closed.';
  END IF;
  IF NEW.bid_amount < COALESCE(a.min_bid, 0) THEN
    RAISE EXCEPTION 'Bid is below the minimum allowed discount of ₹%.', (COALESCE(a.min_bid, 0) / 100);
  END IF;
  IF COALESCE(a.max_bid, 0) > 0 AND NEW.bid_amount > a.max_bid THEN
    RAISE EXCEPTION 'Bid exceeds the maximum allowed discount of ₹%.', (a.max_bid / 100);
  END IF;
  IF COALESCE(a.current_bid, 0) > 0 AND NEW.bid_amount <= a.current_bid THEN
    RAISE EXCEPTION 'Your bid of ₹% must be higher than the current highest bid of ₹%.',
      (NEW.bid_amount / 100), (a.current_bid / 100);
  END IF;
  IF NEW.customer_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.auction_participants ap
     WHERE ap.auction_id = NEW.auction_id
       AND ap.customer_id = NEW.customer_id
  ) THEN
    RAISE EXCEPTION 'You must join the auction before bidding.';
  END IF;
  IF NEW.bidder_name IS NULL THEN
    SELECT full_name INTO NEW.bidder_name
      FROM public.customers WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_current_highest_bid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.auctions
     SET current_bid = NEW.bid_amount
   WHERE id = NEW.auction_id
     AND NEW.bid_amount > COALESCE(current_bid, 0);
  RETURN NEW;
END;
$$;

-- Preserve the settlement implementation from migration 042 behind a guarded
-- public entry point. The wrapper locks first and rejects every replay.
-- Idempotent: only rename when 042's raw implementation is still under the
-- public name and the unchecked copy does not exist yet. Lets this migration
-- be re-applied over a partially migrated database without erroring.
DO $rename$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_auction_settlement'
      AND pg_get_function_identity_arguments(p.oid)
          = 'uuid, uuid, text, bigint, bigint, bigint, bigint, bigint, bigint'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'apply_auction_settlement_once_unchecked'
  ) THEN
    ALTER FUNCTION public.apply_auction_settlement(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT)
      RENAME TO apply_auction_settlement_once_unchecked;
  END IF;
END
$rename$;

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
  v_status TEXT;
  v_total_shares NUMERIC;
  v_updated INTEGER;
BEGIN
  SELECT status INTO v_status
    FROM public.auctions
   WHERE id = p_auction_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Auction not found'; END IF;
  IF v_status = 'completed' THEN RAISE EXCEPTION 'Auction is already finalized'; END IF;
  IF v_status <> 'live' THEN RAISE EXCEPTION 'Only a live auction can be finalized'; END IF;

  SELECT COALESCE(SUM(COALESCE(participation_share, 1)), 0)
    INTO v_total_shares
    FROM public.chit_members
   WHERE chit_group_id = (SELECT chit_group_id FROM public.auctions WHERE id = p_auction_id);

  SELECT result.updated_members INTO v_updated
    FROM public.apply_auction_settlement_once_unchecked(
      p_auction_id, p_winner_member_id, p_winner_name, p_current_bid,
      p_installment_due, p_dividend_amount, p_discount_amount,
      p_final_due_amount, p_winner_prize_amount
    ) AS result;

  UPDATE public.auctions
     SET commission_amount = GREATEST(
       p_discount_amount - ROUND(p_dividend_amount * v_total_shares), 0
     )
   WHERE id = p_auction_id;

  RETURN QUERY SELECT v_updated;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_auction_settlement_once_unchecked(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_auction_settlement(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_auction_settlement(UUID, UUID, TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT)
  TO service_role;

NOTIFY pgrst, 'reload schema';
