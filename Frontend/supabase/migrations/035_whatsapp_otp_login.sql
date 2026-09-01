-- ============================================================
-- 035_whatsapp_otp_login.sql
-- Support WhatsApp OTP login with real Supabase Auth sessions.
-- ============================================================

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customers_auth_user_id
  ON public.customers(auth_user_id);

CREATE TABLE IF NOT EXISTS public.whatsapp_otp_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE NOT NULL,
  phone_hash TEXT NOT NULL,
  otp_hash TEXT NOT NULL,
  send_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (send_status IN ('pending', 'sent', 'failed')),
  gupshup_message_id TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.whatsapp_otp_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_customer_created
  ON public.whatsapp_otp_requests(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_phone_created
  ON public.whatsapp_otp_requests(phone_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whatsapp_otp_active
  ON public.whatsapp_otp_requests(customer_id, expires_at)
  WHERE consumed_at IS NULL;
