-- ============================================================
-- 034_whatsapp_consent.sql
-- Store WhatsApp consent state on customers.
-- ============================================================

ALTER TABLE public.customers
ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS whatsapp_opt_in_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS whatsapp_opt_out_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_customers_whatsapp_opt_in
  ON public.customers(whatsapp_opt_in);
