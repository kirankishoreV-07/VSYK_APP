# Admin Customer Detail Page - Implementation Summary

## Overview
Successfully rebuilt the admin customer detail page as a comprehensive nested-tab interface per the requirements document. The implementation provides a drill-downable view that surfaces complete customer chit history.

## Files Created/Modified

### Main Page
- **`Frontend/app/(admin)/customers/[id].tsx`** - Complete rewrite of the main customer detail screen with tab-based navigation

### Shared Components (`Frontend/app/(admin)/customers/_components/`)
1. **`types.ts`** - TypeScript type definitions for all customer detail data structures
2. **`utils.ts`** - Utility functions for formatting (paise, dates, IST conversion), calculations, CSV export
3. **`CustomerHeader.tsx`** - Sticky header component with avatar, profile info, KYC/risk badges, quick actions
4. **`KPIStrip.tsx`** - Always-visible KPI metrics strip (Active Chits, Lifetime Paid, Dividend Earned, Outstanding, On-time %)
5. **`OuterTabs.tsx`** - Outer tab navigation component (Overview, Groups, Payments, Auctions, Diagnostics, Activity)
6. **`OverviewTab.tsx`** - Overview tab with health snapshot, upcoming dues, recent transactions, active groups summary
7. **`GroupsTab.tsx`** - Groups tab with horizontal chip selector + inner tabs (Summary, Payment History, Auction History, Documents, Ledger)
8. **`PaymentsTab.tsx`** - Payments cross-group view (placeholder)
9. **`AuctionsTab.tsx`** - Auctions timeline (placeholder)
10. **`DiagnosticsTab.tsx`** - Diagnostics and data quality (placeholder)
11. **`ActivityTab.tsx`** - Activity log (placeholder)

### React Query Hooks (`Frontend/lib/hooks/admin/`)
- **`useCustomerDetailData.ts`** - Main data fetching hook with Supabase Realtime subscription

## Features Implemented

### ✅ Phase 1 Complete: Shell + Overview + Groups Structure
- [x] Sticky customer header with avatar, name, phone, email, customer ID, member-since date
- [x] KYC badge (verified/pending/rejected) with color coding
- [x] Risk badge derived from overdue count and on-time % (labeled "Derived")
- [x] Quick action buttons (Call, Email) with disabled states when data missing
- [x] KPI strip with 5 metrics always visible
- [x] Outer tab navigation (6 tabs)
- [x] Overview tab fully implemented with:
  - Health snapshot card
  - Upcoming dues (next 30 days)
  - Last 5 transactions with "View all" link to Payments tab
  - Active groups horizontal scroll (max 3 visible)
  - Most recent auction outcome card
- [x] Groups tab structure with:
  - Horizontal chip strip group selector
  - Inner tab navigation per selected group
  - Placeholder content for all 5 inner tabs
- [x] Placeholder tabs for Payments, Auctions, Diagnostics, Activity

### 🔄 Phase 2: Remaining Work

#### Groups Tab Inner Tabs
- [ ] **Payment History Inner Tab**:
  - Visual month strip with status icons (paid, partial, due, overdue, future, won)
  - Full payment table with all cycles (no pagination)
  - Columns: Cycle, Due Date, Original Amount, Dividend Applied, Net Due, Paid On, Paid Amount, Method, Status, Ref ID, Action
  - Handle 9 edge cases: partial payments, late payments, failed-then-retried, refunds, won cycle, foreclosed group, manual adjustments, dividend recalculations, missing schedules
  - Row click opens side drawer with transaction details
  - CSV export functionality
- [ ] **Summary Inner Tab**: Group metadata, member role, ticket number, chit value, monthly installment, tenure, current cycle, next due date, totals
- [ ] **Auction History Inner Tab**: All auctions in group with participation status (Won/Bid/Did Not Participate), bid amounts, winner, discount
- [ ] **Documents Inner Tab**: Already has placeholder (intentional - no table invented)
- [ ] **Ledger Inner Tab**: Chronological running ledger with Date, Description, Debit, Credit, Balance columns

#### Payments Tab (Cross-Group View)
- [ ] Summary strip: Paid This Year, Pending Now, Overdue, Failed Last 30 Days
- [ ] One compact month-strip per active group
- [ ] Combined recent transactions table (last 90 days)
- [ ] Filters: date range, status, method, group

#### Auctions Tab
- [ ] Timeline of every auction customer touched across all groups
- [ ] Filter chips: All, Won, Outbid, Did Not Participate
- [ ] Entry details: date, group name, cycle number, outcome, winning bid, discount

#### Diagnostics Tab
- [ ] Razorpay orders table (parse from transaction notes)
- [ ] Failed payments table
- [ ] Webhook events placeholder (explicitly marked as TODO)
- [ ] Refund history placeholder (explicitly marked as TODO)

#### Activity Tab
- [ ] Already has correct placeholder (waiting for audit_events table)

## Technical Implementation Details

### Data Fetching Strategy
- **Eager loading on mount**: Customer profile, memberships, schedules, transactions, auctions, participants
- **React Query** with 2-minute stale time
- **Supabase Realtime** subscription on `chit_member_transactions` table
- **Query invalidation** on real-time updates to refetch data

### State Management
- **Outer tab**: Local component state (`useState`)
- **Selected group + inner tab**: Local state in GroupsTab component
- **No URL params**: Kept simple since this is admin-only, not shareable
- **Justification**: Admin workflow is session-based; URL persistence not needed

### TypeScript Compliance
- ✅ All types strictly defined (no `any`)
- ✅ Explicit return types on functions
- ✅ Proper null handling with optional chaining
- ✅ Union types for status fields

### Money & Timestamps
- ✅ All money stored/calculated in paise (integer)
- ✅ Formatted to rupees with Indian number format only at render
- ✅ All timestamps stored UTC in database
- ✅ Converted to IST (UTC+5:30) only at display time
- ✅ Utility functions: `formatPaise()`, `formatDateIST()`, `formatDateTimeIST()`

### Component Organization
- ✅ Each component under ~300 lines (largest is OverviewTab at ~470 lines, will split if needed during Phase 2)
- ✅ Shared components in `_components/` directory
- ✅ Reused existing `formatPaise` and `formatShortDate` from `useDashboard.ts`
- ✅ New admin hooks in `lib/hooks/admin/`

## Schema Assumptions

### Confirmed Tables (queried successfully)
- `customers` - id, customer_id, full_name, phone, email, customer_type, kyc_status, created_at
- `chit_members` - id, chit_group_id, customer_id, ticket_number, current_month, bid_status, joined_at
- `chit_groups` - id, name, value, duration_months, monthly_installment, status, start_date
- `payment_schedules` - id, chit_member_id, month_number, due_date, amount, paid, paid_at, dividend_amount
- `chit_member_transactions` - id, chit_member_id, auction_id, amount, payment_type, status, transaction_date, notes
- `auctions` - id, chit_group_id, auction_number, scheduled_at, status, winner_member_id, winner_name, installment_due, dividend_amount, discount_amount, final_due_amount, winner_prize_amount, ended_at
- `auction_participants` - id, auction_id, customer_id, joined_at

### Missing Tables (explicitly handled with placeholders)
- ❌ `customer_documents` - Placeholder message in Documents inner tab
- ❌ `webhook_events` - Placeholder card in Diagnostics tab
- ❌ `refunds` - Placeholder card in Diagnostics tab (alternative: parse from transactions or use Razorpay API proxy)
- ❌ `audit_events` - Placeholder message in Activity tab

## Dividend Model Compliance
✅ **Pre-deduction model honored**: The "Dividend Applied" column will reflect the discount subtracted at collection time, not a post-auction payout. This is documented in types and utils.

## Edge Cases

### Implemented in Phase 1
- ✅ **No groups**: Empty state with helpful message in GroupsTab
- ✅ **Missing phone/email**: Disabled action buttons with explanatory text
- ✅ **No upcoming dues**: Empty state message
- ✅ **No recent transactions**: Empty state message
- ✅ **No recent auction**: Card not rendered

### To Implement in Phase 2 (Payment History)
- [ ] Partial payments - multiple rows per cycle with running balance
- [ ] Late payments - "Paid (Late Nd)" badge
- [ ] Failed-then-retried - grayed failed row visually linked to retry
- [ ] Refunded - strikethrough original + refund row below
- [ ] Won cycle - gold accent styling
- [ ] Foreclosed group - table ends at foreclosure with settlement row
- [ ] Admin manual adjustments - show admin name, reason, timestamp
- [ ] Dividend recalculation - original vs. corrected with audit tooltip
- [ ] Missing schedule rows - "Schedule missing — investigate" warning

## Manual Test Checklist

### Shell & Navigation (✅ Ready to test)
1. Navigate to admin customer detail page - verify header, KPI strip, tabs render without errors
2. Click each outer tab - verify tab switches and content area updates
3. Verify back button navigates to customers list
4. Test with customer who has no phone - verify Call button is disabled
5. Test with customer who has no email - verify Email button is disabled

### Overview Tab (✅ Ready to test)
6. Verify health snapshot shows correct risk level, overdue count, outstanding
7. Verify upcoming dues section shows only payments due in next 30 days
8. Verify recent transactions section shows last 5 transactions
9. Click "View all →" link - verify it switches to Payments tab
10. Verify active groups horizontal scroll works (test with customer in 4+ groups)

### Groups Tab (✅ Ready to test)
11. Select different groups from chip strip - verify selection updates
12. Verify inner tabs render for selected group
13. Test with customer in no groups - verify empty state message
14. Verify group chip shows correct status badge color

### Real-time Updates (✅ Ready to test)
15. Have another admin create a new transaction for the customer - verify KPI strip updates automatically
16. Verify no console errors or warnings during page load

### Error Handling (✅ Ready to test)
17. Navigate to non-existent customer ID - verify error message displays
18. Test with slow/failed network - verify loading and error states

## Deferred TODOs

### Intentional Placeholders (Not Missing Tables)
1. **Documents Inner Tab**: Placeholder message - requires `customer_documents` table schema design
2. **Webhook Events (Diagnostics)**: Placeholder card - requires `webhook_events` table or Supabase Edge Function to persist webhook payloads
3. **Refund History (Diagnostics)**: Placeholder card - requires either `refunds` table or server-side Razorpay API proxy (cannot call Razorpay API from client)
4. **Activity Tab**: Placeholder - requires `audit_events` table to track KYC changes, nominee updates, login events, admin actions

### Phase 2 Work (Blocked on Time, Not Data)
5. **Payment History Inner Tab**: Full implementation with month strip, table, edge cases, CSV export
6. **Payments Tab**: Cross-group payment view with summary strip and filters
7. **Auctions Tab**: Timeline with participation filter chips
8. **Diagnostics Tab**: Razorpay orders parsing, failed payments table
9. **Summary Inner Tab**: Group metadata display
10. **Auction History Inner Tab**: Per-group auction list with participation status
11. **Ledger Inner Tab**: Chronological money movement ledger

### Future Enhancements
12. **PDF Export**: Deferred - CSV only for now (uses expo-file-system + expo-sharing)
13. **Transaction Detail Drawer**: Side drawer/modal on payment row click with Razorpay payload, webhook events, retry history
14. **Search by Ref ID**: In Payment History table
15. **Column Sorting**: Sticky headers with sort on Payment History table
16. **Infinite Scroll**: Activity timeline (20 events at a time)

## Next Steps

1. **Review this Phase 1 shell** - Verify the structure, navigation, Overview tab, and Groups tab skeleton meet expectations
2. **Provide feedback** on any UX, data, or scope questions
3. **Approve Phase 2 priorities** - Which inner tabs/outer tabs to build next (recommend Payment History first)
4. **Schema decisions** - Confirm missing tables or alternative approaches for Documents, Webhooks, Refunds, Activity

## Commit Recommendation
Commit this Phase 1 work as: "feat(admin): rebuild customer detail page shell with Overview + Groups structure"

Then proceed with Phase 2 tab-by-tab with incremental commits.
