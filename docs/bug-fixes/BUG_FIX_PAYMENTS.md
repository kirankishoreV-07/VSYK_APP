# Bug Fix - Missing Props in Detail Routes

## Issue
```
ERROR [TypeError: Cannot read property 'filter' of undefined]
Code: PaymentsTab.tsx:32
schedules.filter(s => !s.paid)
```

## Root Cause
The detail route files were not passing all required props to their respective tab components.

## Files Fixed

### 1. `/Frontend/app/(admin)/customers/[id]/payments.tsx`
**Problem**: Missing `schedules` prop  
**Fix**: Added `schedules` to destructured data and passed to PaymentsTab

**Before**:
```typescript
const { customer, memberships, transactions } = data;
<PaymentsTab memberships={memberships} transactions={transactions} />
```

**After**:
```typescript
const { customer, memberships, transactions, schedules } = data;
<PaymentsTab memberships={memberships} transactions={transactions} schedules={schedules} />
```

### 2. `/Frontend/app/(admin)/customers/[id]/diagnostics.tsx`
**Problem**: Missing `memberships` prop  
**Fix**: Added `memberships` to destructured data and passed to DiagnosticsTab

**Before**:
```typescript
const { customer, transactions, schedules } = data;
<DiagnosticsTab transactions={transactions} schedules={schedules} />
```

**After**:
```typescript
const { customer, transactions, schedules, memberships } = data;
<DiagnosticsTab transactions={transactions} schedules={schedules} memberships={memberships} />
```

### 3. `/Frontend/app/(admin)/customers/_components/PaymentsTab.tsx`
**Problem**: No defensive check for undefined schedules  
**Fix**: Added default empty array and null-coalescing in useMemo

**Before**:
```typescript
export function PaymentsTab({ memberships, transactions, schedules }: PaymentsTabProps) {
  const pendingNow = schedules.filter(s => !s.paid)...
  const overdueCount = schedules.filter(s => {...
```

**After**:
```typescript
export function PaymentsTab({ memberships, transactions, schedules = [] }: PaymentsTabProps) {
  const pendingNow = (schedules || []).filter(s => !s.paid)...
  const overdueCount = (schedules || []).filter(s => {...
```

## Verification

All route files now properly pass required props:

✅ **payments.tsx**: `memberships`, `transactions`, `schedules`  
✅ **diagnostics.tsx**: `transactions`, `schedules`, `memberships`  
✅ **auctions.tsx**: `memberships`, `auctions`, `participants` (was already correct)  
✅ **groups.tsx**: `memberships`, `schedules`, `transactions`, `auctions`, `participants` (was already correct)  
✅ **activity.tsx**: No props needed (placeholder component)

## Testing
- [x] No TypeScript errors
- [x] All diagnostics pass
- [ ] Runtime test: Navigate to Payments tab - should load without crash
- [ ] Runtime test: Navigate to Diagnostics tab - should load without crash

## Related Components

All tab components require specific props from `useCustomerDetailData`:

| Component | Required Props |
|-----------|----------------|
| PaymentsTab | memberships, transactions, schedules |
| DiagnosticsTab | transactions, schedules, memberships |
| AuctionsTab | memberships, auctions, participants |
| GroupsTab | memberships, schedules, transactions, auctions, participants |
| ActivityTab | None (placeholder) |

## Prevention
To prevent this in the future:
1. Always check component prop interfaces before passing data
2. Use TypeScript strict mode (already enabled)
3. Add default values for array props to prevent undefined errors
4. Test navigation to all routes after making structural changes
