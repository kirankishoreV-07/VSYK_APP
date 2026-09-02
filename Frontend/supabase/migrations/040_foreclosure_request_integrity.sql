-- One active foreclosure review per chit membership. The member-facing API
-- is idempotent, and this partial unique index also closes concurrent races.
CREATE UNIQUE INDEX IF NOT EXISTS idx_foreclosure_requests_one_pending
  ON public.foreclosure_requests(chit_member_id)
  WHERE status = 'pending';
