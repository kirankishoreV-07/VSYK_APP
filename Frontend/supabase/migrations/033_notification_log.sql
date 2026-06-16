-- Dedupe log for scheduled push notifications.
-- The auction scheduler runs every 60s; without a record of what was already
-- sent it would re-fire the same "starting soon" / "payment due" reminder on
-- every tick. Each notification has a deterministic key (type + entity id);
-- the UNIQUE constraint makes a second insert fail so we send exactly once.
CREATE TABLE IF NOT EXISTS public.notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_key TEXT NOT NULL UNIQUE,
  notification_type TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_log_type ON public.notification_log(notification_type);

ALTER TABLE public.notification_log ENABLE ROW LEVEL SECURITY;

-- Backend uses the service role (bypasses RLS). This open policy mirrors the
-- demo-friendly policies used elsewhere in this project (see 017_open_rls_for_demo).
DROP POLICY IF EXISTS "notification_log_all" ON public.notification_log;
CREATE POLICY "notification_log_all" ON public.notification_log
  FOR ALL USING (true) WITH CHECK (true);
