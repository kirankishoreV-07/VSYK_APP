-- ============================================================
-- 020_auction_customer_identity.sql
-- Support customer-based bidding/joining for demo auth flow
-- ============================================================

ALTER TABLE public.auction_bids
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.auction_bids
ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.auction_participants
ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

ALTER TABLE public.auction_participants
ALTER COLUMN user_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auction_bids_customer_id ON public.auction_bids(customer_id);
CREATE INDEX IF NOT EXISTS idx_auction_participants_customer_id ON public.auction_participants(customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS unique_auction_customer
ON public.auction_participants(auction_id, customer_id);
