-- Phase 6: replace every USING(true)/WITH CHECK(true) "demo" policy with
-- real per-member / per-admin policies. Uses is_admin() / current_customer_id()
-- / is_own_chit_member() from 037_admin_auth_rework.sql.
--
-- IMPORTANT identity note (confirmed by full Frontend audit before writing
-- this): chit_members.user_id, auction_bids.user_id, and
-- auction_participants.user_id are legacy columns that are NEVER populated
-- by any real write path (every insert uses customer_id). Any policy keyed
-- off those columns is permanently dead for real data. The only reliable
-- member-identity chain is auth.uid() -> customers.auth_user_id ->
-- customers.id -> *.customer_id, which is what every policy below uses.
--
-- Tables intentionally left alone (already correct, zero live risk):
--   whatsapp_otp_requests, payment_orders — RLS enabled, zero policies,
--     service-role-only by design already.
--   auction_reminders — already uses real auth.uid() (a genuinely
--     authenticated member session), not a dead user_id column.
--   profiles, nominees — legacy/unused schema, no live Frontend query.

-- Helper to drop every existing policy on a table without needing to know
-- every historical policy name across 30+ prior migrations.
CREATE OR REPLACE FUNCTION public._drop_all_policies(p_table TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE pol RECORD;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = p_table LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, p_table);
  END LOOP;
END;
$$;

-- ── customers ────────────────────────────────────────────────────────────
SELECT public._drop_all_policies('customers');
CREATE POLICY "customers_select_own_or_admin" ON public.customers
  FOR SELECT USING (id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "customers_update_own_or_admin" ON public.customers
  FOR UPDATE USING (id = public.current_customer_id() OR public.is_admin())
  WITH CHECK (id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "customers_insert_admin_only" ON public.customers
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "customers_delete_admin_only" ON public.customers
  FOR DELETE USING (public.is_admin());

-- ── chit_members ─────────────────────────────────────────────────────────
SELECT public._drop_all_policies('chit_members');
CREATE POLICY "chit_members_select_own_or_admin" ON public.chit_members
  FOR SELECT USING (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "chit_members_insert_own_or_admin" ON public.chit_members
  FOR INSERT WITH CHECK (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "chit_members_update_admin_only" ON public.chit_members
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "chit_members_delete_admin_only" ON public.chit_members
  FOR DELETE USING (public.is_admin());

-- ── chit_groups ──────────────────────────────────────────────────────────
-- Group discovery (browsing active groups to join) is intentionally public
-- to all authenticated members; a member's OWN group stays visible after it
-- stops being 'active' (history views).
SELECT public._drop_all_policies('chit_groups');
CREATE POLICY "chit_groups_select_active_own_or_admin" ON public.chit_groups
  FOR SELECT USING (
    status = 'active'
    OR public.is_admin()
    OR id IN (SELECT chit_group_id FROM public.chit_members WHERE customer_id = public.current_customer_id())
  );
CREATE POLICY "chit_groups_insert_admin_only" ON public.chit_groups
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "chit_groups_update_admin_only" ON public.chit_groups
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "chit_groups_delete_admin_only" ON public.chit_groups
  FOR DELETE USING (public.is_admin());

-- ── auctions ─────────────────────────────────────────────────────────────
SELECT public._drop_all_policies('auctions');
CREATE POLICY "auctions_select_own_group_or_admin" ON public.auctions
  FOR SELECT USING (
    public.is_admin()
    OR chit_group_id IN (SELECT chit_group_id FROM public.chit_members WHERE customer_id = public.current_customer_id())
  );
CREATE POLICY "auctions_insert_admin_only" ON public.auctions
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "auctions_update_admin_only" ON public.auctions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auctions_delete_admin_only" ON public.auctions
  FOR DELETE USING (public.is_admin());

-- ── auction_bids ─────────────────────────────────────────────────────────
-- Bids are private: the member app only ever queries the caller's own bids
-- (confirmed — no member-facing "all bids" leaderboard; that view is
-- admin-only), so SELECT is intentionally NOT group-wide.
SELECT public._drop_all_policies('auction_bids');
CREATE POLICY "auction_bids_select_own_or_admin" ON public.auction_bids
  FOR SELECT USING (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "auction_bids_insert_own_or_admin" ON public.auction_bids
  FOR INSERT WITH CHECK (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "auction_bids_update_own_or_admin" ON public.auction_bids
  FOR UPDATE USING (customer_id = public.current_customer_id() OR public.is_admin())
  WITH CHECK (customer_id = public.current_customer_id() OR public.is_admin());

-- ── auction_participants ────────────────────────────────────────────────
SELECT public._drop_all_policies('auction_participants');
CREATE POLICY "auction_participants_select_own_or_admin" ON public.auction_participants
  FOR SELECT USING (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "auction_participants_insert_own_or_admin" ON public.auction_participants
  FOR INSERT WITH CHECK (customer_id = public.current_customer_id() OR public.is_admin());
CREATE POLICY "auction_participants_delete_own_or_admin" ON public.auction_participants
  FOR DELETE USING (customer_id = public.current_customer_id() OR public.is_admin());

-- ── payment_schedules ────────────────────────────────────────────────────
-- Members SELECT their own schedules and INSERT their own (client-side
-- auto-generation, ensurePaymentSchedules). UPDATE (paid/paid_amount) is
-- admin/backend-only — the member app never updates this table directly;
-- Backend/src/payments/payments.ts always writes via the service role
-- (bypasses RLS), and admin settlement now runs under a real admin session.
SELECT public._drop_all_policies('payment_schedules');
CREATE POLICY "payment_schedules_select_own_or_admin" ON public.payment_schedules
  FOR SELECT USING (public.is_own_chit_member(chit_member_id) OR public.is_admin());
CREATE POLICY "payment_schedules_insert_own_or_admin" ON public.payment_schedules
  FOR INSERT WITH CHECK (public.is_own_chit_member(chit_member_id) OR public.is_admin());
CREATE POLICY "payment_schedules_update_admin_only" ON public.payment_schedules
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "payment_schedules_delete_admin_only" ON public.payment_schedules
  FOR DELETE USING (public.is_admin());

-- ── chit_member_transactions ─────────────────────────────────────────────
SELECT public._drop_all_policies('chit_member_transactions');
CREATE POLICY "chit_member_transactions_select_own_or_admin" ON public.chit_member_transactions
  FOR SELECT USING (public.is_own_chit_member(chit_member_id) OR public.is_admin());
CREATE POLICY "chit_member_transactions_write_admin_only" ON public.chit_member_transactions
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "chit_member_transactions_update_admin_only" ON public.chit_member_transactions
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "chit_member_transactions_delete_admin_only" ON public.chit_member_transactions
  FOR DELETE USING (public.is_admin());

-- ── cash_collections ─────────────────────────────────────────────────────
SELECT public._drop_all_policies('cash_collections');
CREATE POLICY "cash_collections_select_own_or_admin" ON public.cash_collections
  FOR SELECT USING (public.is_own_chit_member(chit_member_id) OR public.is_admin());
CREATE POLICY "cash_collections_insert_admin_only" ON public.cash_collections
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "cash_collections_update_admin_only" ON public.cash_collections
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "cash_collections_delete_admin_only" ON public.cash_collections
  FOR DELETE USING (public.is_admin());

-- ── auction_prize_settlements ────────────────────────────────────────────
SELECT public._drop_all_policies('auction_prize_settlements');
CREATE POLICY "auction_prize_settlements_select_own_or_admin" ON public.auction_prize_settlements
  FOR SELECT USING (public.is_own_chit_member(chit_member_id) OR public.is_admin());
CREATE POLICY "auction_prize_settlements_insert_admin_only" ON public.auction_prize_settlements
  FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "auction_prize_settlements_update_admin_only" ON public.auction_prize_settlements
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "auction_prize_settlements_delete_admin_only" ON public.auction_prize_settlements
  FOR DELETE USING (public.is_admin());

-- ── member_device_tokens ─────────────────────────────────────────────────
SELECT public._drop_all_policies('member_device_tokens');
CREATE POLICY "member_device_tokens_own_or_admin" ON public.member_device_tokens
  FOR ALL USING (customer_id = public.current_customer_id() OR public.is_admin())
  WITH CHECK (customer_id = public.current_customer_id() OR public.is_admin());

-- ── Internal/system tables: no legitimate anon-key need at all ──────────
-- notification_log, foreclosure_requests, auction_events: confirmed zero
-- live Frontend usage (foreclosure_requests, auction_events) or
-- service-role-only usage (notification_log). Dropping their open "demo"/
-- fake-admin policies leaves RLS enabled with NO policies, matching the
-- already-correct pattern used by whatsapp_otp_requests/payment_orders —
-- deny-by-default for anon/authenticated, service role bypasses RLS.
SELECT public._drop_all_policies('notification_log');
SELECT public._drop_all_policies('foreclosure_requests');
SELECT public._drop_all_policies('auction_events');

DROP FUNCTION public._drop_all_policies(TEXT);
