-- ============================================================
-- 030_auction_prize_settlements.sql
-- Track manual prize / settlement payouts to auction winners
-- Supports partial settlements for both 'accounted' and 'unaccounted' groups.
-- Admin records actual disbursements of winner_prize_amount.
-- Both admin and members can see settled vs. remaining.
-- ============================================================

-- Main table for prize payouts (supports multiple partials per winner per auction)

CREATE TABLE IF NOT EXISTS public.auction_prize_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auction_id UUID REFERENCES public.auctions(id) ON DELETE CASCADE NOT NULL,
    chit_member_id UUID REFERENCES public.chit_members(id) ON DELETE CASCADE NOT NULL,
    amount BIGINT NOT NULL, -- paise paid in this partial settlement / payout
    -- Denomination breakdown (primarily for unaccounted/cash groups; 0 for accounted)
    denomination_500 INTEGER DEFAULT 0,
    denomination_200 INTEGER DEFAULT 0,
    denomination_100 INTEGER DEFAULT 0,
    denomination_50 INTEGER DEFAULT 0,
    denomination_20 INTEGER DEFAULT 0,
    denomination_10 INTEGER DEFAULT 0,
    notes TEXT, -- internal admin notes / reference (e.g. transfer ID for accounted)
    recorded_by UUID REFERENCES auth.users(id),
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auction_prize_settlements ENABLE ROW LEVEL SECURITY;

-- Idempotency: drop existing policies first so this migration can be safely
-- re-run in the Supabase SQL editor without "policy already exists" (42710).
DROP POLICY IF EXISTS "Admin can insert prize settlements"  ON public.auction_prize_settlements;
DROP POLICY IF EXISTS "Admin can view all prize settlements" ON public.auction_prize_settlements;
DROP POLICY IF EXISTS "Admin can update prize settlements"   ON public.auction_prize_settlements;
DROP POLICY IF EXISTS "Admin can delete prize settlements"   ON public.auction_prize_settlements;
DROP POLICY IF EXISTS "Members can view own prize settlements" ON public.auction_prize_settlements;

-- Admin full access (demo + real use)
CREATE POLICY "Admin can insert prize settlements"
  ON public.auction_prize_settlements FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can view all prize settlements"
  ON public.auction_prize_settlements FOR SELECT
  USING (true);

CREATE POLICY "Admin can update prize settlements"
  ON public.auction_prize_settlements FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete prize settlements"
  ON public.auction_prize_settlements FOR DELETE
  USING (true);

-- Members can view their own prize settlements (via their chit membership being the winner)
CREATE POLICY "Members can view own prize settlements"
  ON public.auction_prize_settlements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chit_members cm
      WHERE cm.id = auction_prize_settlements.chit_member_id
        AND cm.user_id = auth.uid()
    )
  );

-- Customer-safe view (strips sensitive admin fields like denominations + recorded_by for privacy)
CREATE OR REPLACE VIEW public.v_customer_prize_settlements AS
SELECT 
    aps.id,
    aps.auction_id,
    aps.chit_member_id,
    aps.amount,
    aps.notes,           -- keep minimal notes if useful for member (can be filtered later)
    aps.recorded_at,
    a.chit_group_id,
    a.auction_number,
    a.winner_prize_amount AS total_prize,
    a.winner_member_id,
    cm.customer_id,
    cg.name AS group_name,
    cg.accounting_type
FROM public.auction_prize_settlements aps
JOIN public.auctions a ON a.id = aps.auction_id
JOIN public.chit_members cm ON cm.id = aps.chit_member_id
JOIN public.chit_groups cg ON cg.id = a.chit_group_id
WHERE cm.user_id = auth.uid();

-- Indexes for fast lookup by auction (admin group view) and by member (customer + realtime)
CREATE INDEX IF NOT EXISTS idx_auction_prize_settlements_auction ON public.auction_prize_settlements(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_prize_settlements_member ON public.auction_prize_settlements(chit_member_id);
CREATE INDEX IF NOT EXISTS idx_auction_prize_settlements_auction_member ON public.auction_prize_settlements(auction_id, chit_member_id);
CREATE INDEX IF NOT EXISTS idx_auction_prize_settlements_recorded_at ON public.auction_prize_settlements(recorded_at);

-- Update timestamp trigger (for edits)
CREATE OR REPLACE FUNCTION public.update_auction_prize_settlement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_auction_prize_settlement_timestamp ON public.auction_prize_settlements;

CREATE TRIGGER trigger_update_auction_prize_settlement_timestamp
BEFORE UPDATE ON public.auction_prize_settlements
FOR EACH ROW
EXECUTE FUNCTION public.update_auction_prize_settlement_timestamp();

-- Optional: convenience function or comment for cumulative
-- settled_prize for an auction/winner = SUM(amount) over rows for that (auction_id, chit_member_id)
-- remaining = auction.winner_prize_amount - settled_prize

COMMENT ON TABLE public.auction_prize_settlements IS 
'Records actual disbursements (full or partial) of auction winner_prize_amount to the winning chit_member. Works for both accounted and unaccounted groups. Multiple rows = partial settlements. Denominations used mainly for unaccounted cash payouts.';

-- Make sure the view owner is set for security (common pattern)
ALTER VIEW public.v_customer_prize_settlements OWNER TO postgres;