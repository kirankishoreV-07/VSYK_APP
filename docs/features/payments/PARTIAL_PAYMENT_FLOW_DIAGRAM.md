# Partial Payment System - Visual Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CUSTOMER APP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  ChitDetailScreen                                       │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ useChitDetail()                                   │  │    │
│  │  │ - Fetches chit_members + chit_groups             │  │    │
│  │  │ - Gets payment_schedules                          │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ useGroupAuctions()                               │  │    │
│  │  │ - Fetches auctions for group                     │  │    │
│  │  │ - Provides settlement data                        │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ usePartialPayments() ◄─── NEW!                  │  │    │
│  │  │ - Fetches chit_member_transactions               │  │    │
│  │  │ - Groups by month_number                         │  │    │
│  │  │ - Returns {month: totalPaid}                     │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  │                                                          │    │
│  │  ┌──────────────────────────────────────────────────┐  │    │
│  │  │ Timeline Rendering                               │  │    │
│  │  │ ┌─────────────────────────────────────────────┐  │  │    │
│  │  │ │ Month 1: ✓ Paid                             │  │  │    │
│  │  │ │ Month 2: ✓ Paid                             │  │  │    │
│  │  │ │ Month 3: ⚠️ ₹500 paid · ₹500 due ◄─── NEW! │  │  │    │
│  │  │ │ Month 4: ⏳ Scheduled                        │  │  │    │
│  │  │ │ Month 5: ⏳ Scheduled                        │  │  │    │
│  │  │ └─────────────────────────────────────────────┘  │  │    │
│  │  └──────────────────────────────────────────────────┘  │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Real-time Updates
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────┐  ┌──────────────────────┐             │
│  │ payment_schedules   │  │ chit_member_         │             │
│  ├─────────────────────┤  │   transactions       │             │
│  │ id                  │  ├──────────────────────┤             │
│  │ month_number: 3     │  │ id                   │             │
│  │ amount: 100000      │  │ chit_member_id       │             │
│  │ paid: false ────────┼──┼─► auction_id ◄─ NEW!│             │
│  │ dividend_amount     │  │ amount: 50000        │             │
│  └─────────────────────┘  │ payment_type         │             │
│                            │ status: completed    │             │
│  ┌─────────────────────┐  │ notes: "Month 3"     │             │
│  │ auctions            │  └──────────────────────┘             │
│  ├─────────────────────┤            │                           │
│  │ id ◄────────────────┼────────────┘                           │
│  │ auction_number: 3   │                                        │
│  │ final_due_amount    │  ┌──────────────────────┐             │
│  │ status: completed   │  │ v_member_auction_    │             │
│  └─────────────────────┘  │   payments (VIEW)    │             │
│                            ├──────────────────────┤             │
│                            │ SELECT               │             │
│                            │   chit_member_id,    │             │
│                            │   auction_id,        │             │
│                            │   SUM(amount)        │             │
│                            │ GROUP BY ...         │             │
│                            └──────────────────────┘             │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Payment Flow - Detailed

### Scenario: Customer Pays First Partial (₹500 of ₹1,000)

```
1. USER ACTION
   ┌──────────────────────────────────┐
   │ Customer clicks "PAY NOW"        │
   │ Month 3: ₹1,000 due              │
   └────────────┬─────────────────────┘
                │
                ▼
2. MODAL OPENS
   ┌──────────────────────────────────┐
   │ Pay Installment                  │
   │ Month 3 · Due ₹1,000            │
   │                                  │
   │ [Pay Full] [Pay Partial] ◄─      │
   │                            │     │
   │ Enter amount: ₹500 ◄───────┘     │
   │                                  │
   │     [Cancel]  [Pay Now]          │
   └────────────┬─────────────────────┘
                │
                ▼
3. PAYMENT PROCESSING
   ┌──────────────────────────────────┐
   │ handlePayment(                   │
   │   payment: Month3Row,            │
   │   payableAmount: 100000,         │
   │   payAmount: 50000               │
   │ )                                │
   └────────────┬─────────────────────┘
                │
                ▼
4. CHECK PREVIOUS PAYMENTS
   ┌──────────────────────────────────┐
   │ SELECT amount                    │
   │ FROM chit_member_transactions    │
   │ WHERE chit_member_id = X         │
   │   AND (auction_id = Y            │
   │        OR notes ILIKE '%Month 3%')│
   │                                  │
   │ Result: [] (no previous)         │
   │ previousTotal = 0                │
   └────────────┬─────────────────────┘
                │
                ▼
5. CALCULATE CUMULATIVE
   ┌──────────────────────────────────┐
   │ totalPaidIncludingCurrent =      │
   │   previousTotal + amountInPaise  │
   │ = 0 + 50000                      │
   │ = 50000                          │
   │                                  │
   │ isFullPayment =                  │
   │   50000 >= 100000                │
   │ = false                          │
   └────────────┬─────────────────────┘
                │
                ▼
6. INSERT TRANSACTION (NO SCHEDULE UPDATE)
   ┌──────────────────────────────────┐
   │ INSERT INTO                      │
   │   chit_member_transactions       │
   │ VALUES (                         │
   │   chit_member_id: X,             │
   │   auction_id: Y,                 │
   │   amount: 50000,                 │
   │   payment_type: 'installment',   │
   │   status: 'completed',           │
   │   notes: 'Month 3'               │
   │ )                                │
   │                                  │
   │ ✗ Skip payment_schedules update  │
   │   (isFullPayment = false)        │
   └────────────┬─────────────────────┘
                │
                ▼
7. USER FEEDBACK
   ┌──────────────────────────────────┐
   │ Alert:                           │
   │ "Partial Payment Recorded"       │
   │                                  │
   │ "Paid ₹500 for Month 3"         │
   │                                  │
   │ "Remaining: ₹500"               │
   └────────────┬─────────────────────┘
                │
                ▼
8. UI UPDATE
   ┌──────────────────────────────────┐
   │ Query Invalidation:              │
   │ ✓ chit-detail                    │
   │ ✓ partial-payments               │
   │ ✓ active-chits                   │
   │ ✓ dashboard-stats                │
   │                                  │
   │ Timeline Re-renders:             │
   │ Month 3: ⚠️ ₹500 paid · ₹500 due │
   │ Button: "PAY REMAINING ₹500"    │
   └──────────────────────────────────┘
```

### Scenario: Customer Completes with Second Partial (₹500)

```
1. USER ACTION
   ┌──────────────────────────────────┐
   │ Customer clicks "PAY REMAINING"  │
   │ Month 3: ₹500 paid · ₹500 due   │
   └────────────┬─────────────────────┘
                │
                ▼
2. MODAL OPENS (CONTEXT-AWARE)
   ┌──────────────────────────────────┐
   │ Pay Installment                  │
   │ Month 3 · ₹500 already paid     │
   │                                  │
   │ ┌────────────────────────────┐   │
   │ │ Original due: ₹1,000       │   │
   │ │ Remaining: ₹500            │   │
   │ └────────────────────────────┘   │
   │                                  │
   │ [Pay Full] [Pay Partial]         │
   │                                  │
   │     [Cancel]  [Pay Now]          │
   └────────────┬─────────────────────┘
                │
                ▼
3. PAYMENT PROCESSING
   ┌──────────────────────────────────┐
   │ handlePayment(                   │
   │   payment: Month3Row,            │
   │   payableAmount: 100000,         │
   │   payAmount: 50000               │
   │ )                                │
   └────────────┬─────────────────────┘
                │
                ▼
4. CHECK PREVIOUS PAYMENTS
   ┌──────────────────────────────────┐
   │ SELECT amount                    │
   │ FROM chit_member_transactions    │
   │ WHERE chit_member_id = X         │
   │   AND (auction_id = Y            │
   │        OR notes ILIKE '%Month 3%')│
   │                                  │
   │ Result: [{amount: 50000}]        │
   │ previousTotal = 50000            │
   └────────────┬─────────────────────┘
                │
                ▼
5. CALCULATE CUMULATIVE
   ┌──────────────────────────────────┐
   │ totalPaidIncludingCurrent =      │
   │   previousTotal + amountInPaise  │
   │ = 50000 + 50000                  │
   │ = 100000                         │
   │                                  │
   │ isFullPayment =                  │
   │   100000 >= 100000               │
   │ = true ✓                         │
   └────────────┬─────────────────────┘
                │
                ▼
6. INSERT TRANSACTION + UPDATE SCHEDULE
   ┌──────────────────────────────────┐
   │ UPDATE payment_schedules         │
   │ SET paid = true,                 │
   │     paid_at = NOW()              │
   │ WHERE id = Month3Row.id          │
   │                                  │
   │ INSERT INTO                      │
   │   chit_member_transactions       │
   │ VALUES (                         │
   │   amount: 50000,                 │
   │   ...                            │
   │ )                                │
   └────────────┬─────────────────────┘
                │
                ▼
7. USER FEEDBACK
   ┌──────────────────────────────────┐
   │ Alert:                           │
   │ "Payment Completed!"             │
   │                                  │
   │ "Month 3 fully paid with ₹500"  │
   │                                  │
   │ "Total paid for this month:      │
   │  ₹1,000"                        │
   └────────────┬─────────────────────┘
                │
                ▼
8. UI UPDATE
   ┌──────────────────────────────────┐
   │ Timeline Re-renders:             │
   │ Month 3: ✓ Paid on Jun 3, 2026  │
   │                                  │
   │ Progress bar updates             │
   │ Statistics refresh               │
   └──────────────────────────────────┘
```

## UI State Matrix

```
┌──────────────┬─────────────┬──────────────┬──────────────┬─────────────┐
│ Month State  │ Visual      │ Amount       │ Badge        │ Button      │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Fully Paid   │ Green       │ ₹1,000      │ ✓ Paid       │ (none)      │
│              │ Checkmark   │              │ on [date]    │             │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Unpaid       │ Blue        │ ₹1,000      │ (none)       │ PAY NOW     │
│ (Current)    │ Border      │              │              │ ₹1,000     │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Partial      │ Amber       │ ₹500        │ ₹500 paid   │ PAY         │
│ Payment      │ Border      │              │ · ₹500 due  │ REMAINING   │
│              │             │              │              │ ₹500       │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Overdue      │ Red         │ ₹1,000      │ OVERDUE      │ PAY NOW     │
│ (No Partial) │ Border      │              │              │ - OVERDUE   │
│              │             │              │              │ ₹1,000     │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Overdue      │ Red         │ ₹500        │ ₹500 paid   │ PAY         │
│ (Partial)    │ Border      │              │ · ₹500 due  │ REMAINING   │
│              │             │              │ OVERDUE      │ ₹500       │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Upcoming     │ Gray        │ ₹1,000      │ (none)       │ Scheduled   │
│ (Future)     │ Dashed      │              │              │ Not yet due │
├──────────────┼─────────────┼──────────────┼──────────────┼─────────────┤
│ Auction Live │ Orange      │ ₹850        │ AUCTION      │ PAY NOW     │
│ (Adjusted)   │ Border      │              │ LIVE         │ ₹850       │
└──────────────┴─────────────┴──────────────┴──────────────┴─────────────┘
```

## Real-time Sync Flow

```
ADMIN DEVICE                    SUPABASE                    CUSTOMER DEVICE
     │                             │                              │
     │ 1. Admin logs payment       │                              │
     │ (₹300 for Month 5)          │                              │
     │─────────────────────────────►│                              │
     │                             │                              │
     │                             │ 2. INSERT INTO               │
     │                             │    chit_member_transactions  │
     │                             │                              │
     │                             │ 3. Trigger postgres_changes  │
     │                             │─────────────────────────────►│
     │                             │                              │
     │                             │                              │ 4. Subscription fires
     │                             │                              │    invalidate()
     │                             │                              │
     │                             │ 5. Customer refetches        │
     │                             │◄─────────────────────────────│
     │                             │    usePartialPayments()      │
     │                             │                              │
     │                             │ 6. Return updated data       │
     │                             │─────────────────────────────►│
     │                             │                              │
     │                             │                              │ 7. UI re-renders
     │                             │                              │    Month 5: ⚠️ ₹300 paid
     │                             │                              │             · ₹700 due
```

## Error Handling

```
Payment Flow with Error Scenarios

┌─────────────────────────┐
│ Customer initiates      │
│ payment                 │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Query previous payments │
└───────────┬─────────────┘
            │
            ├─────────────► ERROR: Database timeout
            │                └► Retry with exponential backoff
            │                └► Show "Please try again"
            │
            ▼
┌─────────────────────────┐
│ Razorpay payment        │
└───────────┬─────────────┘
            │
            ├─────────────► ERROR: Payment failed
            │                └► Show Razorpay error message
            │                └► Don't insert transaction
            │
            ├─────────────► ERROR: User cancelled
            │                └► Silent (no error shown)
            │
            ▼
┌─────────────────────────┐
│ Verify payment          │
└───────────┬─────────────┘
            │
            ├─────────────► ERROR: Signature mismatch
            │                └► Show "Verification failed"
            │                └► Contact admin message
            │
            ▼
┌─────────────────────────┐
│ Insert transaction      │
└───────────┬─────────────┘
            │
            ├─────────────► ERROR: Insert failed (RLS?)
            │                └► Log error (non-critical)
            │                └► Continue to success
            │
            ▼
┌─────────────────────────┐
│ Update schedule (if     │
│ full payment)           │
└───────────┬─────────────┘
            │
            ├─────────────► ERROR: Update failed
            │                └► Throw error
            │                └► Show "Payment recorded but
            │                    schedule update failed"
            │
            ▼
┌─────────────────────────┐
│ Show success message    │
└─────────────────────────┘
```

This visual guide provides a comprehensive understanding of the partial payment system architecture and flow.
