-- 37 Phase 6: replace the decorative admin login (plaintext admin_users table,
-- publicly SELECT-able via the anon key, no session ever issued) with real
-- Supabase Auth. Admin identity is now a Supabase Auth user; admin_users
-- becomes a thin membership marker keyed by auth.uid(), checked via a
-- SECURITY DEFINER helper so it can be referenced from other tables' RLS
-- policies regardless of the caller's own row-level access to this table.

DROP POLICY IF EXISTS "Allow public read access to verify admin credentials" ON public.admin_users;
DROP TABLE IF EXISTS public.admin_users CASCADE;

CREATE TABLE public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- An admin may read their own membership row (used by the app to confirm
-- admin status after login). No INSERT/UPDATE/DELETE policy — only the
-- service role grants/revokes admin membership.
CREATE POLICY "admin_can_read_own_row" ON public.admin_users
  FOR SELECT USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.admin_users WHERE id = auth.uid());
$$;

-- The member-side identity chain: auth.uid() -> customers.auth_user_id ->
-- customers.id. customers.auth_user_id is only populated after a member's
-- first successful OTP login (Backend/src/auth/otp.ts) — before that, this
-- returns NULL, which correctly denies member-scoped access until login.
CREATE OR REPLACE FUNCTION public.current_customer_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.customers WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_own_chit_member(p_chit_member_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chit_members cm
    WHERE cm.id = p_chit_member_id AND cm.customer_id = public.current_customer_id()
  );
$$;
