-- ============================================================
-- 044_fix_retract_recalc_privileges.sql
-- Retracting a bid left auctions.current_bid showing the retracted amount.
--
-- Cause: recalc_current_bid_after_retract() (032) runs as the INVOKER. The
-- retract itself is performed by the member, so the trigger's
-- "UPDATE public.auctions SET current_bid = ..." is evaluated against
-- auctions_update_admin_only (038). RLS filters the row out, so the update
-- silently affects 0 rows and raises no error, and current_bid keeps the
-- retracted bid's value. Every downstream figure derived from it — highest
-- discount, "must beat", winner prize, dividend — is then wrong, and a
-- settlement run off that value would move real money on a bid nobody holds.
--
-- The AFTER INSERT twin update_current_highest_bid (043) is already
-- SECURITY DEFINER, which is why placing a bid updated current_bid correctly
-- while retracting one did not. This aligns the two.
--
-- Safety: the function only ever writes a MAX() over that auction's own
-- non-retracted bids, so running it as definer cannot set an arbitrary value.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_current_bid_after_retract()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_highest BIGINT;
BEGIN
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
$$;

DROP TRIGGER IF EXISTS trg_recalc_current_bid_after_retract ON public.auction_bids;
CREATE TRIGGER trg_recalc_current_bid_after_retract
  AFTER UPDATE ON public.auction_bids
  FOR EACH ROW
  EXECUTE FUNCTION public.recalc_current_bid_after_retract();

-- Repair auctions whose current_bid drifted while the trigger was powerless.
-- Scoped to auctions that are not yet completed: settled auctions keep the
-- figures their settlement was computed from and must not be rewritten.
UPDATE public.auctions a
   SET current_bid = COALESCE(
     (SELECT MAX(b.bid_amount)
        FROM public.auction_bids b
       WHERE b.auction_id = a.id
         AND b.is_retracted = FALSE), 0)
 WHERE a.status <> 'completed'
   AND a.current_bid IS DISTINCT FROM COALESCE(
     (SELECT MAX(b.bid_amount)
        FROM public.auction_bids b
       WHERE b.auction_id = a.id
         AND b.is_retracted = FALSE), 0);

NOTIFY pgrst, 'reload schema';
