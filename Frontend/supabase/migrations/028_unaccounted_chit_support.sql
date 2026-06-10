-- ============================================================
-- 028_unaccounted_chit_support.sql
-- Add support for unaccounted (cash-only) chit groups
-- ============================================================

-- Add accounting_type column to chit_groups
ALTER TABLE public.chit_groups 
ADD COLUMN IF NOT EXISTS accounting_type TEXT NOT NULL DEFAULT 'accounted'
CHECK (accounting_type IN ('accounted', 'unaccounted'));

-- Create cash_collections table to record physical cash collections
CREATE TABLE IF NOT EXISTS public.cash_collections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chit_member_id UUID REFERENCES public.chit_members(id) ON DELETE CASCADE NOT NULL,
    month_number INTEGER NOT NULL,
    amount BIGINT NOT NULL, -- in paise
    denomination_500 INTEGER DEFAULT 0,
    denomination_200 INTEGER DEFAULT 0,
    denomination_100 INTEGER DEFAULT 0,
    denomination_50 INTEGER DEFAULT 0,
    denomination_20 INTEGER DEFAULT 0,
    denomination_10 INTEGER DEFAULT 0,
    notes TEXT, -- internal admin notes only
    recorded_by UUID REFERENCES auth.users(id), -- staff/admin who recorded
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(chit_member_id, month_number) -- One collection per member per month
);

ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;

-- Admin policies for cash_collections
CREATE POLICY "Admin can insert cash collections"
  ON public.cash_collections FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admin can view all cash collections"
  ON public.cash_collections FOR SELECT
  USING (true);

CREATE POLICY "Admin can update cash collections"
  ON public.cash_collections FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admin can delete cash collections"
  ON public.cash_collections FOR DELETE
  USING (true);

-- Users can view their own cash collections (but not admin-only fields)
CREATE POLICY "Users can view own cash collections"
  ON public.cash_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chit_members cm
      WHERE cm.id = cash_collections.chit_member_id
        AND cm.user_id = auth.uid()
    )
  );

-- View for customer-side cash collection timeline (strips admin-only fields)
CREATE OR REPLACE VIEW public.v_customer_cash_collections AS
SELECT 
    cc.id,
    cc.chit_member_id,
    cc.month_number,
    cc.amount,
    cc.recorded_at,
    cm.chit_group_id,
    cg.monthly_installment,
    CASE 
        WHEN cc.amount >= cg.monthly_installment THEN 'Full'
        WHEN cc.amount > 0 THEN 'Partial'
        ELSE 'Unpaid'
    END as payment_status
FROM public.cash_collections cc
JOIN public.chit_members cm ON cm.id = cc.chit_member_id
JOIN public.chit_groups cg ON cg.id = cm.chit_group_id
WHERE cm.user_id = auth.uid();

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_cash_collections_member ON public.cash_collections(chit_member_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_month ON public.cash_collections(chit_member_id, month_number);
CREATE INDEX IF NOT EXISTS idx_chit_groups_accounting_type ON public.chit_groups(accounting_type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_cash_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cash_collection_timestamp
BEFORE UPDATE ON public.cash_collections
FOR EACH ROW
EXECUTE FUNCTION update_cash_collection_timestamp();
