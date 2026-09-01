-- Phase 6: account-deletion request flow (App Store 5.1.1(v) requires an
-- in-app path to initiate account deletion). Chit fund memberships carry
-- ongoing financial obligations, so this is a reviewed request, not an
-- instant self-service hard delete — the member initiates it in-app,
-- Backend/src/account/deletion.ts processes it by anonymizing PII while
-- financial/audit records (payment_schedules, chit_member_transactions,
-- chit_members, auctions, auction_bids) are left completely untouched.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deletion_processed_at TIMESTAMPTZ;
