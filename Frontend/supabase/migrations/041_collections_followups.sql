-- ============================================================
-- Migration 041: Collections Follow-up worklist (admin-only, no staff login)
-- ============================================================
-- staff_members: a lightweight directory (name + phone) of the people the
-- admin assigns collections calls to. This is NOT an auth/login table —
-- there is only one admin login in this app; staff are named so the admin
-- can assign/track work and so WhatsApp digests have somewhere to go.
--
-- collection_followups: one row per (member, unpaid installment, day) — the
-- day's task. status='collected' is an OPERATIONAL marker only (staff
-- reported cash/payment in hand); it never touches payment_schedules.paid/
-- paid_amount, which change only through the existing verified paths
-- (Backend/src/payments/payments.ts razorpay/verify, or the existing
-- RecordCashCollectionModal admin flow). This preserves the "never mark
-- paid without verification" rule already enforced everywhere else.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_members_admin_only" ON public.staff_members;
CREATE POLICY "staff_members_admin_only" ON public.staff_members
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.collection_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_member_id UUID NOT NULL REFERENCES public.chit_members(id) ON DELETE CASCADE,
  payment_schedule_id UUID NOT NULL REFERENCES public.payment_schedules(id) ON DELETE CASCADE,
  follow_up_date DATE NOT NULL,
  assigned_staff_id UUID REFERENCES public.staff_members(id) ON DELETE SET NULL,
  priority TEXT NOT NULL CHECK (priority IN ('high', 'medium', 'low')),
  days_overdue INTEGER NOT NULL DEFAULT 0,
  amount_due BIGINT NOT NULL,            -- remaining paise, snapshot at generation time
  suggested_action TEXT NOT NULL,        -- plain, rule-based text — never framed as "AI"
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'contacted', 'promised', 'collected', 'no_response')),
  outcome_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chit_member_id, payment_schedule_id, follow_up_date)
);

CREATE INDEX IF NOT EXISTS idx_collection_followups_date ON public.collection_followups(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_collection_followups_staff ON public.collection_followups(assigned_staff_id);

ALTER TABLE public.collection_followups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "collection_followups_admin_only" ON public.collection_followups;
CREATE POLICY "collection_followups_admin_only" ON public.collection_followups
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';
