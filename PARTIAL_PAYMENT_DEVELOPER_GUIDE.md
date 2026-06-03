# Partial Payment System - Developer Guide

## How It Works

### Data Flow

```
Customer initiates payment
    ↓
handlePayment() called with payment details
    ↓
Query previous payments for this month
    ↓
Calculate: previousTotal + currentPayment
    ↓
Check: cumulativeTotal >= monthlyDue?
    ├─ YES → Mark payment_schedule.paid = true
    └─ NO  → Leave payment_schedule.paid = false
    ↓
Insert transaction with auction_id
    ↓
Invalidate queries (triggers UI refresh)
    ↓
Show context-aware success message
```

### Database Tables Involved

#### 1. `chit_member_transactions`
Records every payment (partial or full):
```sql
- id: UUID
- chit_member_id: UUID (link to membership)
- auction_id: UUID (link to specific auction/month)
- amount: BIGINT (in paise)
- payment_type: 'installment' | 'penalty' | 'registration'
- status: 'completed' | 'failed' | 'refunded'
- transaction_date: TIMESTAMPTZ
- notes: TEXT (contains month number and payment ID)
```

#### 2. `payment_schedules`
Master schedule of expected payments:
```sql
- id: UUID
- chit_member_id: UUID
- month_number: INT
- due_date: DATE
- amount: BIGINT (can be adjusted by dividends)
- paid: BOOLEAN (true when cumulative >= amount)
- paid_at: TIMESTAMPTZ
- dividend_amount: BIGINT
```

#### 3. `auctions`
Settlement data per month:
```sql
- id: UUID
- auction_number: INT
- final_due_amount: BIGINT (amount after discount/dividend)
- dividend_amount: BIGINT
- status: 'upcoming' | 'live' | 'completed'
```

### Key Functions

#### `usePartialPayments(membershipId, auctions)`
Fetches and aggregates partial payments:

```typescript
// Returns: { 1: 50000, 3: 75000 } // month_number: total_paid_in_paise
{
  1: 50000,  // Month 1: ₹500 paid
  3: 75000,  // Month 3: ₹750 paid
}
```

**Logic**:
1. Fetch all `chit_member_transactions` for this member
2. Filter by `payment_type='installment'` and `status='completed'`
3. Group by month using:
   - `auction_id` mapping (preferred)
   - Fallback: parse month number from `notes` field
4. Sum amounts per month

#### `handlePayment(payment, payableAmount, payAmount)`
Processes a payment and updates records:

**Parameters**:
- `payment`: PaymentRow - The schedule entry being paid
- `payableAmount`: number - Expected amount (after dividends)
- `payAmount`: number - Actual amount customer is paying

**Steps**:
1. Get auction for this month
2. Query previous partial payments using:
   ```sql
   WHERE chit_member_id = X
   AND payment_type = 'installment'
   AND status = 'completed'
   AND (auction_id = Y OR notes ILIKE '%Month Z%')
   ```
3. Calculate cumulative: `previousTotal + payAmount`
4. Check if full: `cumulative >= payableAmount`
5. If full: Update `payment_schedules.paid = true`
6. Insert new transaction with `auction_id`
7. Show appropriate alert
8. Invalidate queries

### UI Components

#### MonthTimelineItem
Displays a single month's payment status:

**Props**:
- `p`: PaymentRow - Schedule entry
- `partialPaid`: number - Total paid so far (from usePartialPayments)
- `payableAmount`: number - Expected amount
- ... (other props for styling/callbacks)

**Computed Values**:
```typescript
hasPartialPayment = !isPaid && partialPaid > 0
remainingAmount = payableAmount - partialPaid
```

**Visual States**:
1. **Fully Paid**: Green, checkmark, shows paid date
2. **Unpaid, No Partial**: Default, shows full amount
3. **Partial Payment**: Amber badge showing "₹X paid · ₹Y due"
4. **Overdue**: Red, urgent styling
5. **Upcoming**: Grayed out, dashed border

#### Payment Modal
Context-aware payment sheet:

**Scenarios**:

**Scenario A: No Previous Partial**
```
Pay Installment
Month 5 · Due ₹1,000

[ Pay Full ] [ Pay Partial ]

[Cancel] [Pay Now]
```

**Scenario B: Has Previous Partial (₹600 paid)**
```
Pay Installment
Month 5 · ₹600 already paid

┌─────────────────────────┐
│ Original due: ₹1,000    │
│ Remaining: ₹400         │
└─────────────────────────┘

[ Pay Full ] [ Pay Partial ]

[Cancel] [Pay Now]
```

**Logic**:
- "Pay Full" = remaining amount (not original)
- "Pay Partial" max = remaining amount
- Input validation prevents overpayment

### Query Invalidation Strategy

After any payment operation:
```typescript
queryClient.invalidateQueries({ queryKey: ['chit-detail', id, memberId] });
queryClient.invalidateQueries({ queryKey: ['partial-payments', id] });
queryClient.invalidateQueries({ queryKey: ['active-chits', memberId] });
queryClient.invalidateQueries({ queryKey: ['dashboard-stats', memberId] });
```

Real-time subscriptions:
```typescript
supabase.channel(`chit-detail-${id}`)
  .on('postgres_changes', { table: 'chit_members' }, invalidate)
  .on('postgres_changes', { table: 'payment_schedules' }, invalidate)
  .on('postgres_changes', { table: 'chit_member_transactions' }, invalidate)
```

## Common Scenarios

### Scenario 1: Customer Pays ₹500 of ₹1,000
1. Customer clicks "PAY NOW" for Month 5
2. Selects "Pay Partial", enters ₹500
3. `handlePayment` called: `payAmount = 50000` (paise)
4. Query previous: `previousTotal = 0`
5. Cumulative: `0 + 50000 = 50000` (< 100000 = not full)
6. Insert transaction: `amount=50000, auction_id=X, notes="Month 5"`
7. `payment_schedules.paid` stays `false`
8. Alert: "Partial Payment Recorded - Remaining: ₹500"
9. UI updates: Badge shows "₹500 paid · ₹500 due"

### Scenario 2: Customer Completes with Second Partial
1. Customer clicks "PAY REMAINING" (now shows ₹500)
2. Selects "Pay Full" (which is the ₹500 remaining)
3. `handlePayment` called: `payAmount = 50000`
4. Query previous: `previousTotal = 50000`
5. Cumulative: `50000 + 50000 = 100000` (= 100000 = FULL!)
6. Insert transaction: `amount=50000, auction_id=X, notes="Month 5"`
7. Update: `payment_schedules.paid = true, paid_at = NOW()`
8. Alert: "Payment Completed! Total paid: ₹1,000"
9. UI updates: Green checkmark, "Paid on [date]"

### Scenario 3: Admin Logs Offline Payment
1. Admin goes to group detail, member transactions
2. Enters ₹700, selects auction for Month 5
3. Admin's logic inserts transaction with `auction_id`
4. Real-time subscription fires on customer device
5. `usePartialPayments` refetches
6. Customer UI shows "₹700 paid · ₹300 due"
7. Customer can now pay remaining ₹300

## Debugging

### Check Total Paid for a Month
```sql
SELECT 
  SUM(amount) as total_paid
FROM chit_member_transactions
WHERE chit_member_id = '<member-id>'
  AND payment_type = 'installment'
  AND status = 'completed'
  AND (
    auction_id = '<auction-id>'
    OR notes ILIKE '%Month <N>%'
  );
```

### Check If Schedule Marked Paid
```sql
SELECT paid, paid_at, amount
FROM payment_schedules
WHERE chit_member_id = '<member-id>'
  AND month_number = <N>;
```

### Verify auction_id Linkage
```sql
SELECT 
  t.id,
  t.amount,
  t.notes,
  a.auction_number
FROM chit_member_transactions t
LEFT JOIN auctions a ON t.auction_id = a.id
WHERE t.chit_member_id = '<member-id>'
ORDER BY t.transaction_date DESC;
```

### Common Issues

**Issue**: Partial payments not showing
- Check: `usePartialPayments` query is enabled (`!!membershipId`)
- Check: `auction_id` is set OR `notes` contains "Month X"
- Check: Transaction `status = 'completed'`

**Issue**: Schedule not marking paid after full amount
- Check: Cumulative total calculation includes all previous
- Check: `.or()` query syntax for auction_id fallback
- Check: `isFullPayment` logic: `cumulative >= payableAmount`

**Issue**: UI not updating after payment
- Check: All 4 queries invalidated (chit-detail, partial-payments, active-chits, dashboard-stats)
- Check: Real-time subscription includes `chit_member_transactions` table
- Check: React Query cache is not stale

## Testing Tips

1. **Use Test Mode**: Razorpay has a test key - no real charges
2. **Check Browser DevTools**: React Query Devtools shows cache state
3. **Monitor Supabase Logs**: See real-time subscription events
4. **Use Multiple Devices**: Test real-time sync between admin and customer
5. **Clear Cache**: Sometimes needed after schema changes

## Performance Considerations

- `usePartialPayments` only fetches for current member (indexed query)
- `auction_id` provides direct join (faster than parsing notes)
- Real-time subscriptions filter by `chit_member_id` (reduced events)
- Query invalidation is targeted (not global refresh)

## Security

- RLS policies prevent customers seeing other members' transactions
- Admin policies allow full CRUD on transactions
- Payment verification uses Razorpay signature validation
- Amount stored in paise (integer) prevents floating-point errors
