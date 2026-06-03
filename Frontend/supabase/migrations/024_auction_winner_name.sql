-- ============================================================
-- 024_auction_winner_name.sql
-- Add winner_name to auctions for display purposes
-- ============================================================

ALTER TABLE public.auctions
ADD COLUMN IF NOT EXISTS winner_name TEXT;
