# Phase 2 Implementation Roadmap

## Current Status: Phase 1 Complete ✅

**Completed:**
- Shell structure (Header + KPI Strip + Outer Tabs)
- Overview tab (fully functional)
- Groups tab structure (chip selector + inner tab navigation)
- Data fetching hook with real-time updates
- All placeholder tabs created
- TypeScript strict mode compliance
- Zero compilation errors

---

## Phase 2: Priority Order

### Priority 1: Payment History Inner Tab (Highest Value)
**Why first?** This is the most complex and most frequently used admin feature. Verifying payments is a daily task.

#### Tasks:
1. **Month Strip Component** (~100 lines)
   - Visual timeline with status icons (paid, partial, due, overdue, future, won)
   - One square per installment month
   - Click to scroll to corresponding table row
   - Color coding per status

2. **Payment Table Component** (~200 lines)
   - Columns: Cycle, Due Date, Original Amount, Dividend Applied, Net Due, Paid On, Paid Amount, Method, Status, Ref ID, Action
   - Full table (no pagination) with virtualization for 100+ rows
   - Sticky column headers on scroll
   - Support for all edge cases:
     - ✅ Partial payments (multiple rows per cycle with running balance)
     - ✅ Late payments ("Paid (Late Nd)" badge)
     - ✅ Failed-then-retried (grayed failed row visually linked to retry)
     - ✅ Refunded (strikethrough original + refund row)
     - ✅ Won cycle (gold accent styling)
     - ✅ Foreclosed group (settlement row)
     - ✅ Manual adjustments (admin name, reason, timestamp)
     - ✅ Dividend recalculation (original vs. corrected with tooltip)
     - ✅ Missing schedule (warning message)

3. **Transaction Detail Drawer** (~150 lines)
   - Side drawer (modal on mobile)
   - Display Razorpay payload from transaction.notes JSON
   - Show retry history
   - Parse webhook events if available

4. **Filters Component** (~80 lines)
   - Status dropdown (All, Full, Partial, Unpaid, Overdue)
   - Year dropdown
   - Method dropdown (Razorpay, Manual, etc.)
   - Ref ID search input

5. **CSV Export Function** (~50 lines)
   - Use existing `exportToCSV()` utility
   - expo-file-system + expo-sharing
   - Generate filename with timestamp
   - Handle all edge cases in export

**Estimated Total:** ~580 lines across 5 new files
**Testing Focus:** All 9 edge cases + CSV round-trip

---

### Priority 2: Summary Inner Tab (Quick Win)
**Why second?** Simpler than Payment History, provides essential group context.

#### Tasks:
1. **Summary Display Component** (~150 lines)
   - Group metadata card:
     - Chit value, monthly installment, tenure
     - Start date, current cycle, status
     - Member's ticket number, role, joined date
   - Totals card:
     - Total paid vs. total due
     - Outstanding amount
     - Completion percentage
     - Next due date and amount
   - Progress bar visualization

**Estimated Total:** ~150 lines in 1 file
**Testing Focus:** Accurate calculations, foreclosed group handling

---

### Priority 3: Auction History Inner Tab
**Why third?** Completes the Groups tab inner navigation.

#### Tasks:
1. **Auction History Table Component** (~180 lines)
   - Table columns: Auction #, Date, Status, Winner, Prize, Discount, Participation
   - Participation badges (Won, Bid, Did Not Participate)
   - Visual distinction for customer's won auctions
   - Empty state for groups with no auctions yet

**Estimated Total:** ~180 lines in 1 file
**Testing Focus:** Participation status accuracy, won cycle detection

---

### Priority 4: Ledger Inner Tab
**Why fourth?** Provides complete financial audit trail for the group.

#### Tasks:
1. **Ledger Component** (~200 lines)
   - Chronological table: Date, Description, Debit, Credit, Balance
   - Entry types: installment, dividend, refund, adjustment, prize
   - Running balance calculation
   - Filter by entry type
   - Export to CSV

**Estimated Total:** ~200 lines in 1 file
**Testing Focus:** Balance accuracy, all transaction types included

---

### Priority 5: Payments Tab (Cross-Group View)
**Why fifth?** Complements Payment History with overview across all groups.

#### Tasks:
1. **Payment Summary Strip** (~80 lines)
   - Paid This Year
   - Pending Now
   - Overdue
   - Failed Last 30 Days

2. **Per-Group Month Strips** (~100 lines)
   - One compact strip per active group
   - Scannable at a glance
   - Click to navigate to that group's Payment History

3. **Combined Transactions Table** (~200 lines)
   - Default last 90 days
   - Filters: date range, status, method, group selector
   - Sort by date descending
   - Row click opens detail drawer

**Estimated Total:** ~380 lines across 3 components
**Testing Focus:** Cross-group aggregation accuracy, filter combinations

---

### Priority 6: Auctions Tab
**Why sixth?** Timeline view for auction participation across all groups.

#### Tasks:
1. **Auction Timeline Component** (~200 lines)
   - Chronological list of all auctions customer touched
   - Filter chips: All, Won, Outbid, Did Not Participate
   - Entry cards showing:
     - Date, group name, cycle number
     - Outcome (Won/Outbid/Not Participated)
     - Winning bid, discount applied to customer
     - Winner name

**Estimated Total:** ~200 lines in 1 file
**Testing Focus:** Filter accuracy, discount calculations

---

### Priority 7: Diagnostics Tab
**Why seventh?** Useful for troubleshooting but less frequent than payment views.

#### Tasks:
1. **Razorpay Orders Table** (~120 lines)
   - Last 20 order IDs
   - Parse from transaction.notes JSON
   - Show current state (success, failed, refunded)

2. **Failed Payments Table** (~120 lines)
   - Filter transactions where status = 'failed'
   - Parse error code and message from notes
   - Link to retry transaction

3. **Placeholder Cards** (~60 lines)
   - Webhook events card: "Requires webhook persistence table — TODO"
   - Refund history card: "Requires refunds table or Razorpay API proxy — TODO"

**Estimated Total:** ~300 lines across 3 components
**Testing Focus:** JSON parsing robustness, error message extraction

---

### Priority 8: Documents Inner Tab (Deferred)
**Why last?** Requires `customer_documents` table schema design and Supabase Storage integration.

#### Requirements Before Implementation:
- Schema decision: How to store document metadata?
- Supabase Storage bucket setup
- File upload/download permissions
- Document types: Aadhaar, PAN, signed agreements, nominee forms

**Blocked By:** Schema design + Storage configuration

---

### Priority 9: Activity Tab (Deferred)
**Why last?** Requires `audit_events` table to track all customer actions and admin modifications.

#### Requirements Before Implementation:
- Schema decision: `audit_events` table structure
- Backend triggers to capture events:
  - KYC status changes
  - Nominee updates
  - Login events
  - Admin actions (manual adjustments, status changes)

**Blocked By:** Schema design + Backend triggers

---

## Incremental Commit Strategy

| Priority | Feature | Commit Message |
|----------|---------|----------------|
| 1 | Payment History | `feat(admin): implement payment history inner tab with month strip and full table` |
| 2 | Summary | `feat(admin): add group summary inner tab with metadata and totals` |
| 3 | Auction History | `feat(admin): implement auction history inner tab with participation tracking` |
| 4 | Ledger | `feat(admin): add ledger inner tab with running balance` |
| 5 | Payments Tab | `feat(admin): implement cross-group payments tab with summary strip` |
| 6 | Auctions Tab | `feat(admin): add auctions timeline tab across all groups` |
| 7 | Diagnostics | `feat(admin): implement diagnostics tab with Razorpay orders and failed payments` |
| 8 | Documents | `feat(admin): add documents inner tab with upload/download` (future) |
| 9 | Activity | `feat(admin): implement activity log tab with audit trail` (future) |

---

## Testing Plan Per Priority

### After Each Priority Implementation:
1. **Unit Tests** (if test framework exists):
   - Calculation functions (totals, balances, percentages)
   - CSV export round-trip
   - Date formatting (UTC → IST)
   - Money formatting (paise → rupees)

2. **Manual Smoke Tests**:
   - Load page with customer in 0 groups, 1 group, 5+ groups
   - Test each edge case scenario (see edge case lists per priority)
   - Verify real-time updates (create transaction in another tab)
   - Test filters and search inputs
   - Export CSV and verify content

3. **TypeScript Compliance**:
   - Run `getDiagnostics` on new files
   - Ensure no `any` types introduced
   - Verify strict null checks

4. **Performance**:
   - Test with customer having 100+ payment schedules
   - Verify virtualized table scrolls smoothly
   - Check React Query cache invalidation scope

---

## Open Questions for Phase 2

### Before Starting Priority 1 (Payment History):
1. **Transaction drawer**: Should it be a side drawer (desktop) + bottom sheet (mobile), or always modal?
2. **Virtualization library**: Use `react-native-virtualized-view` or `FlashList`? (Need to check existing dependencies)
3. **CSV export**: Should it include transactions sub-rows or only schedule-level data?

### Before Starting Priority 7 (Diagnostics):
4. **Razorpay notes format**: What is the actual JSON structure in `transaction.notes`? (Need sample data)
5. **Error code mapping**: Do we have a standard list of Razorpay error codes to display user-friendly messages?

### Schema Decisions Needed (Priorities 8-9):
6. **Documents table**: Proposed schema for `customer_documents`?
7. **Audit events table**: Proposed schema for `audit_events`?
8. **Webhook persistence**: Should we create `webhook_events` table or use Supabase Edge Function to log?
9. **Refunds**: Should we create dedicated `refunds` table or continue parsing from transactions?

---

## Estimated Timeline

Assuming ~1 hour per component file for implementation + testing:

| Priority | Estimated Hours | Notes |
|----------|----------------|-------|
| 1. Payment History | 10-12 hours | Most complex (5 components + 9 edge cases) |
| 2. Summary | 2-3 hours | Simple data display |
| 3. Auction History | 3-4 hours | Table with participation logic |
| 4. Ledger | 4-5 hours | Running balance calculations |
| 5. Payments Tab | 6-8 hours | Cross-group aggregation |
| 6. Auctions Tab | 4-5 hours | Timeline with filters |
| 7. Diagnostics | 5-6 hours | JSON parsing + error handling |
| **Total Phase 2** | **34-43 hours** | ~1 week full-time or 2-3 weeks part-time |

**Phase 1 Completed:** ~8 hours

---

## Success Criteria (Definition of Done for Phase 2)

- [ ] All 6 outer tabs fully functional (not placeholders)
- [ ] All 5 Groups inner tabs fully functional (not placeholders, except Documents which is intentional)
- [ ] All 9 payment edge cases handled in Payment History
- [ ] CSV export works with valid round-trip
- [ ] Real-time updates work in all relevant tabs
- [ ] No TypeScript errors or warnings
- [ ] All components under ~300 lines (split if needed)
- [ ] Manual test checklist 100% passing
- [ ] No console errors during normal operation
- [ ] Graceful error handling for missing data
- [ ] All placeholder TODOs documented with reasons

---

## Next Immediate Step

**Recommendation**: Start with **Priority 1 (Payment History Inner Tab)**

This is the most valuable feature for admins and will also validate the data structure assumptions before building other tabs.

Suggested order within Priority 1:
1. Build Month Strip first (visual, easy to validate)
2. Build basic Payment Table (no edge cases yet)
3. Add edge case handling one-by-one with tests
4. Add filters
5. Add transaction drawer
6. Add CSV export

**Checkpoint**: After Payment History is complete, pause for review before continuing to Priority 2.
