# Unaccounted Chit Group Feature - Implementation Plan

## Overview
Support cash-only chit groups where staff manually records physical cash collections.

---

## Database Changes

### Migration 028: Add Unaccounted Support

```sql
-- ============================================================
-- 028_unaccounted_chit_support.sql
-- Add support for cash-only unaccounted chit groups
-- ============================================================

-- 1. Add accounting_type to chit_groups
ALTER TABLE public.chit_groups
ADD COLUMN IF NOT EXISTS accounting_type TEXT NOT NULL DEFAULT 'accounted'
  CHECK (accounting_type IN ('accounted', 'unaccounted'));

-- Index for filtering
CREATE INDEX IF NOT EXISTS idx_chit_groups_accounting_type 
ON public.chit_groups(accounting_type);

-- 2. Create cash_collections table for unaccounted payments
CREATE TABLE IF NOT EXISTS public.cash_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chit_member_id UUID REFERENCES public.chit_members(id) ON DELETE CASCADE NOT NULL,
  month_number INTEGER NOT NULL,
  amount BIGINT NOT NULL, -- in paise
  collection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Denomination breakdown (all in paise)
  denomination_500 INTEGER DEFAULT 0,  -- count of ₹500 notes
  denomination_200 INTEGER DEFAULT 0,  -- count of ₹200 notes
  denomination_100 INTEGER DEFAULT 0,  -- count of ₹100 notes
  denomination_50 INTEGER DEFAULT 0,   -- count of ₹50 notes
  denomination_20 INTEGER DEFAULT 0,   -- count of ₹20 notes
  denomination_10 INTEGER DEFAULT 0,   -- count of ₹10 notes
  denomination_5 INTEGER DEFAULT 0,    -- count of ₹5 notes
  denomination_2 INTEGER DEFAULT 0,    -- count of ₹2 coins
  denomination_1 INTEGER DEFAULT 0,    -- count of ₹1 coins
  
  -- Admin-only fields
  notes TEXT,                          -- internal remarks
  recorded_by UUID REFERENCES auth.users(id), -- staff/admin who recorded
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure one collection per month per member (can be edited, not duplicated)
  UNIQUE(chit_member_id, month_number)
);

ALTER TABLE public.cash_collections ENABLE ROW LEVEL SECURITY;

-- Admin can do everything
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

-- Customers can view their collections (but not admin-only fields)
CREATE POLICY "Users can view own cash collections"
  ON public.cash_collections FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chit_members cm
      WHERE cm.id = cash_collections.chit_member_id
        AND cm.user_id = auth.uid()
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cash_collections_member 
ON public.cash_collections(chit_member_id);

CREATE INDEX IF NOT EXISTS idx_cash_collections_month 
ON public.cash_collections(chit_member_id, month_number);

CREATE INDEX IF NOT EXISTS idx_cash_collections_date 
ON public.cash_collections(collection_date);

-- 3. View for customer-safe cash collection display
CREATE OR REPLACE VIEW public.v_customer_cash_collections AS
SELECT 
  cc.id,
  cc.chit_member_id,
  cc.month_number,
  cc.amount,
  cc.collection_date,
  -- Do NOT expose: denomination breakdown, notes, recorded_by
  CASE 
    WHEN ps.amount IS NOT NULL AND cc.amount >= ps.amount THEN 'Full'
    WHEN cc.amount > 0 THEN 'Partial'
    ELSE 'Unpaid'
  END as payment_status
FROM public.cash_collections cc
LEFT JOIN public.payment_schedules ps 
  ON ps.chit_member_id = cc.chit_member_id 
  AND ps.month_number = cc.month_number;

-- RLS for the view
ALTER VIEW public.v_customer_cash_collections OWNER TO postgres;

-- 4. Function to calculate denomination total
CREATE OR REPLACE FUNCTION public.calculate_denomination_total(
  p_500 INTEGER,
  p_200 INTEGER,
  p_100 INTEGER,
  p_50 INTEGER,
  p_20 INTEGER,
  p_10 INTEGER,
  p_5 INTEGER,
  p_2 INTEGER,
  p_1 INTEGER
) RETURNS BIGINT AS $$
BEGIN
  RETURN (
    (p_500 * 50000) + -- ₹500 in paise
    (p_200 * 20000) + -- ₹200 in paise
    (p_100 * 10000) + -- ₹100 in paise
    (p_50 * 5000) +   -- ₹50 in paise
    (p_20 * 2000) +   -- ₹20 in paise
    (p_10 * 1000) +   -- ₹10 in paise
    (p_5 * 500) +     -- ₹5 in paise
    (p_2 * 200) +     -- ₹2 in paise
    (p_1 * 100)       -- ₹1 in paise
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 5. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_cash_collection_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_cash_collection_timestamp
BEFORE UPDATE ON public.cash_collections
FOR EACH ROW
EXECUTE FUNCTION public.update_cash_collection_timestamp();
```

---

## TypeScript Types

### File: `Frontend/app/(admin)/customers/_components/types.ts`

Add these types:

```typescript
export type AccountingType = 'accounted' | 'unaccounted';

export interface CashCollection {
  id: string;
  chit_member_id: string;
  month_number: number;
  amount: number; // paise
  collection_date: string;
  denomination_500: number;
  denomination_200: number;
  denomination_100: number;
  denomination_50: number;
  denomination_20: number;
  denomination_10: number;
  denomination_5: number;
  denomination_2: number;
  denomination_1: number;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CashCollectionInput {
  chit_member_id: string;
  month_number: number;
  amount: number;
  collection_date: string;
  denomination_500: number;
  denomination_200: number;
  denomination_100: number;
  denomination_50: number;
  denomination_20: number;
  denomination_10: number;
  denomination_5: number;
  denomination_2: number;
  denomination_1: number;
  notes: string;
}

// Update ChitGroup interface
export interface ChitGroup {
  // ... existing fields
  accounting_type: AccountingType; // NEW
}
```

---

## Implementation Steps

### Step 1: Database Migration ✅
- Create `028_unaccounted_chit_support.sql`
- Add `accounting_type` column to `chit_groups`
- Create `cash_collections` table
- Create customer-safe view
- Add helper functions and triggers

### Step 2: Update Admin Group Creation
- Add accounting type selector to group creation form
- Default to 'accounted'
- Match existing UI patterns from `customers.tsx`

### Step 3: Customer Side Changes

#### 3a. Group List Display
**File**: `Frontend/app/(tabs)/chits.tsx`
- Show unaccounted groups with muted purple/lavender color
- Add "Cash" badge to unaccounted group pills
- Hide "Pay Now" button for unaccounted groups

#### 3b. Group Detail Payment Timeline
**File**: `Frontend/app/(tabs)/chit/[id].tsx`
- Fetch cash collections for unaccounted groups
- Display as "Paid · Cash · {date} · ₹{amount}"
- Show Full/Partial status
- Never show denomination, notes, or recorder
- Hide all payment action buttons

### Step 4: Admin Side Changes

#### 4a. Customer Detail - Groups Tab
**File**: `Frontend/app/(admin)/customers/_components/GroupsTab.tsx`
- Add "Record Cash Collection" button for unaccounted groups
- Show button only if unpaid months exist
- Button opens cash collection modal

#### 4b. Cash Collection Modal
**New Component**: `Frontend/app/(admin)/customers/_components/RecordCashCollectionModal.tsx`

Features:
- Select month (dropdown of unpaid months)
- Enter amount (₹ input)
- Denomination breakdown:
  - ₹500 × ___
  - ₹200 × ___
  - ₹100 × ___
  - ₹50 × ___
  - ₹20 × ___
  - ₹10 × ___
  - ₹5 × ___
  - ₹2 × ___
  - ₹1 × ___
- Running total display
- Total must match amount entered
- Save button disabled until match
- Optional notes (textarea)
- Match admin modal style from `customers.tsx`

#### 4c. Edit Cash Collection
**Same Modal, Edit Mode**:
- Pre-fill all fields from existing collection
- Same validation (denomination must match amount)
- Update instead of insert

#### 4d. Delete Cash Collection
- Confirmation dialog: "Delete this collection entry? This cannot be undone."
- Remove from database
- Month returns to unpaid status

#### 4e. Payment Timeline Display
- Show cash collections inline with other payments
- Admin sees: edit icon + delete icon per entry
- Denomination breakdown visible on hover or expand
- Status auto-calculates (Full/Partial)

---

## UI Design Specifications

### Colors (Admin Design System)

```typescript
// Unaccounted group colors
const UNACCOUNTED_COLORS = {
  pill: '#E9D5FF',        // Muted purple/lavender
  pillBorder: '#D8B4FE',
  pillText: '#7C3AED',
  badge: '#F3E8FF',
  badgeText: '#6B21A8',
  badgeBorder: '#E9D5FF',
};
```

### Cash Badge Component
```tsx
<View style={styles.cashBadge}>
  <Svg width={12} height={12} viewBox="0 0 24 24" fill="#6B21A8">
    <Path d="M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85..." />
  </Svg>
  <Text style={styles.cashBadgeText}>Cash</Text>
</View>
```

### Denomination Input Row
```tsx
<View style={styles.denominationRow}>
  <Text style={styles.denominationLabel}>₹500 ×</Text>
  <TextInput 
    style={styles.denominationInput}
    keyboardType="number-pad"
    value={denomination500.toString()}
    onChangeText={handleDenominationChange(500)}
  />
  <Text style={styles.denominationTotal}>
    = {formatPaise(denomination500 * 50000)}
  </Text>
</View>
```

---

## Data Flow

### Recording Collection (Admin)

```
Admin opens customer detail
  → Selects unaccounted group
  → Clicks "Record Cash Collection"
  → Modal opens
  → Admin selects month
  → Admin enters amount
  → Admin enters denominations
  → System calculates total
  → If total ≠ amount: Save disabled
  → If total = amount: Save enabled
  → Admin clicks Save
  → Insert into cash_collections table
  → Customer timeline updates immediately
  → Modal closes
```

### Viewing Collections (Customer)

```
Customer opens chit detail
  → System fetches group
  → If accounting_type = 'unaccounted':
      → Hide "Pay Now" button
      → Fetch from v_customer_cash_collections view
      → Display entries as "Paid · Cash · {date} · ₹{amount}"
      → Show Full/Partial status
      → Never show denomination/notes/recorder
```

---

## Edge Cases

### 1. All Months Paid
- "Record Cash Collection" button hidden
- Clear message: "All payments recorded for this group"

### 2. Partial Payment Editing
- If edited from Full → Partial: Status updates automatically
- If edited from Partial → Full: Status updates automatically
- Remaining balance shown in admin timeline

### 3. Month Already Has Collection
- Edit mode instead of create mode
- UNIQUE constraint prevents duplicates
- Clear error if constraint violated

### 4. Denomination Mismatch
```typescript
const denominationTotal = calculateTotal(denominations);
const isValid = denominationTotal === amount;

return (
  <TouchableOpacity 
    disabled={!isValid}
    style={[styles.saveBtn, !isValid && styles.saveBtnDisabled]}
  >
    <Text>Save Collection</Text>
  </TouchableOpacity>
);
```

### 5. Existing Accounted Groups
- All existing groups default to 'accounted'
- Zero impact on existing functionality
- Can never change accounting_type after creation (prevent data corruption)

---

## File Structure

### New Files
```
Frontend/
  app/
    (admin)/
      customers/
        _components/
          RecordCashCollectionModal.tsx        (NEW)
          CashCollectionRow.tsx                (NEW)
  
  supabase/
    migrations/
      028_unaccounted_chit_support.sql         (NEW)
```

### Modified Files
```
Frontend/
  app/
    (admin)/
      customers/
        _components/
          types.ts                             (UPDATE)
          GroupsTab.tsx                        (UPDATE)
          
    (tabs)/
      chits.tsx                                (UPDATE)
      chit/
        [id].tsx                               (UPDATE)
```

---

## Testing Checklist

### Database
- [ ] Migration runs without errors
- [ ] accounting_type defaults to 'accounted'
- [ ] UNIQUE constraint on (chit_member_id, month_number) works
- [ ] Denomination calculation function accurate
- [ ] Customer view filters admin-only fields

### Admin UI
- [ ] Group creation shows accounting type selector
- [ ] Default is 'accounted'
- [ ] "Record Cash Collection" button appears for unaccounted groups
- [ ] Button hidden when all months paid
- [ ] Modal opens with correct styling
- [ ] Denomination total calculates correctly
- [ ] Save disabled when denomination ≠ amount
- [ ] Save enabled when denomination = amount
- [ ] Entry saves successfully
- [ ] Edit mode pre-fills correctly
- [ ] Delete shows confirmation
- [ ] Delete removes entry

### Customer UI
- [ ] Unaccounted groups show purple/lavender color
- [ ] "Cash" badge displays
- [ ] "Pay Now" button hidden
- [ ] Cash collections display correctly
- [ ] Format: "Paid · Cash · {date} · ₹{amount}"
- [ ] Full/Partial status correct
- [ ] Denomination NOT visible
- [ ] Notes NOT visible
- [ ] Recorder NOT visible

### Edge Cases
- [ ] Existing accounted groups unaffected
- [ ] Partial payment status updates on edit
- [ ] Full payment status updates on edit
- [ ] Month returns to unpaid after delete
- [ ] Cannot create duplicate month entry

---

## Success Criteria

✅ Admin can designate groups as unaccounted during creation  
✅ Default remains 'accounted' (existing behavior preserved)  
✅ Admin can record cash collections with denomination breakdown  
✅ Denomination total must match entered amount  
✅ Admin can edit and delete cash collections  
✅ Customer sees unaccounted groups distinctly (purple, Cash badge)  
✅ Customer sees payment timeline but NOT admin-only fields  
✅ Customer cannot take payment action on unaccounted groups  
✅ All existing accounted groups completely unaffected  
✅ Matches admin design system colors and fonts  
✅ Real-time updates work for cash collections  

---

## Implementation Order

1. **Database** - Run migration 028
2. **Types** - Update TypeScript interfaces
3. **Admin Modal** - Build RecordCashCollectionModal component
4. **Admin Groups Tab** - Add "Record Cash Collection" button
5. **Customer Chits List** - Add purple styling and Cash badge
6. **Customer Chit Detail** - Hide Pay button, show cash collections
7. **Testing** - Verify all scenarios
8. **Documentation** - Update user guides

---

## Next Steps

Ready to begin implementation. Start with:
1. Create migration file `028_unaccounted_chit_support.sql`
2. Update types in `types.ts`
3. Build `RecordCashCollectionModal.tsx` component
4. Integrate with GroupsTab

Shall I proceed?
