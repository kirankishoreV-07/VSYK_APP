-- Stream cash collection changes to customer/admin clients.
-- Without publication membership the UI subscription connects successfully
-- but receives no INSERT/UPDATE/DELETE events, so customers only see cash
-- payments after a fresh login or manual reload.

ALTER TABLE public.cash_collections REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cash_collections'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_collections;
  END IF;
END $$;
