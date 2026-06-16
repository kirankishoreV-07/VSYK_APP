-- ============================================================
-- 031_enable_auction_realtime.sql
-- ROOT-CAUSE FIX for "admin does not receive live bid updates".
--
-- The app subscribes to Postgres changes on the auction tables
-- (supabase.channel(...).on('postgres_changes', { table: 'auction_bids' }))
-- on BOTH the member and admin sides. Those subscriptions only ever
-- deliver events if the underlying tables are members of the
-- `supabase_realtime` publication. None of the earlier migrations ever
-- added them, so Postgres logical replication never streamed INSERT/UPDATE
-- rows to the realtime server -> the client channels reached SUBSCRIBED but
-- never fired their callbacks. Data only appeared on a manual refetch
-- (pull-to-refresh, the 20s member poll, or a fresh login).
--
-- This migration:
--   1. Adds the auction tables to the supabase_realtime publication so
--      INSERT/UPDATE/DELETE are streamed to subscribed clients.
--   2. Sets REPLICA IDENTITY FULL so UPDATE and DELETE payloads carry the
--      full OLD row. Bid retracts and current_bid recalculation are UPDATEs
--      and admin/member filters rely on the row's columns (auction_id);
--      without FULL identity the change feed can drop the data needed for
--      server-side `filter: auction_id=eq...` matching.
--
-- Idempotent: safe to re-run. The DO block guards against
-- "table is already member of publication" on repeat applies.
-- ============================================================

-- 1. REPLICA IDENTITY FULL — required for reliable UPDATE/DELETE realtime
--    payloads (retracts, current_bid updates, status changes).
ALTER TABLE public.auctions          REPLICA IDENTITY FULL;
ALTER TABLE public.auction_bids      REPLICA IDENTITY FULL;
ALTER TABLE public.auction_participants REPLICA IDENTITY FULL;
ALTER TABLE public.auction_prize_settlements REPLICA IDENTITY FULL;

-- 2. Add tables to the supabase_realtime publication (create it if a bare
--    project somehow lacks it). ADD TABLE throws if the table is already a
--    member, so guard each one.
DO $$
BEGIN
  -- Ensure the publication exists (Supabase creates it by default, but be safe).
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auction_bids'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_bids;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auction_participants'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_participants;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'auction_prize_settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_prize_settlements;
  END IF;
END $$;
