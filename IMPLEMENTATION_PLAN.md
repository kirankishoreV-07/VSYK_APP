# Implementation Plan - Complete All Customer Detail Features

## Current Status: 11/30 Requirements Complete

This document outlines the step-by-step plan to implement all remaining features with real Supabase data and real-time updates.

---

## Phase 1: Groups Inner Tabs (PRIORITY 1)

### 1.1 Summary Inner Tab
**Status**: Placeholder → Full Implementation  
**Estimated Lines**: ~200  
**Dependencies**: None

**Implementation**:
```typescript
// File: Frontend/app/(admin)/customers/_components/GroupsTab.tsx
// Update the 'summary' case in the switch statement

Features to implement:
✓ Group metadata card
  - Name, status, value, duration, start_date
  - Monthly installment, current cycle
  - Ticket number, bid status

✓ Member progress metrics
  - Months completed / Total months
  - Total paid vs Total due
  - Outstanding amount
  - Completion percentage

✓ Next due information
  - Next due date
  - Next due amount (with dividend if applicable)
  - Days until due

✓ Payment summary stats
  - On-time payment count
  - Late payment count
  - Overdue count
  - Average days late

Data sources:
- membership.chit_groups (already loaded)
- schedules filtered by chit_member_id
- transactions filtered by chit_member_id
```

**Code Structure**:
```typescript
const GroupSummaryInnerTab = ({ 
  membership, 
  schedules, 
  transactions 
}: { 
  membership: ChitMember; 
  schedules: PaymentSchedule[]; 
  transactions: Transaction[] 
}) => {
  // Calculate all metrics
  const groupSchedules = schedules.filter(s => s.chit_member_id === membership.id);
  const groupTransactions = transactions.filter(t => t.chit_member_id === membership.id);
  
  const totalPaid = groupTransactions
    .filter(t => t.status === 'completed' && t.payment_type === 'installment')
    .reduce((sum, t) => sum + t.amount, 0);
    
  const totalDue = groupSchedules.reduce((sum, s) => sum + s.amount, 0);
  const outstanding = totalDue - totalPaid;
  
  // ... more calculations
  
  return (
    <ScrollView>
      {/* Group Info Card */}
      {/* Progress Metrics */}
      {/* Payment Stats */}
      {/* Next Due Card */}
    </ScrollView>
  );
};
```

**Real-time**: 🔄 Updates via existing subscription

---

### 1.2 Payment History Inner Tab with Month Strip
**Status**: Placeholder → Full Implementation  
**Estimated Lines**: ~400 (split into sub-components)  
**Dependencies**: None

**Implementation**:

#### 1.2a Month Strip Component
```typescript
// File: Frontend/app/(admin)/customers/_components/MonthStrip.tsx
// New component - horizontally scrollable month timeline

interface MonthStripProps {
  schedules: PaymentSchedule[];
  transactions: Transaction[];
  durationMonths: number;
  onMonthClick: (monthNumber: number) => void;
  wonMonth?: number;
}

Status determination per month:
- 'won' → Month number matches wonMonth
- 'paid' → schedule.paid === true
- 'partial' → Has transactions but sum < schedule.amount
- 'overdue' → Not paid && due_date < now
- 'due' → Not paid && due_date between now and +7 days
- 'future' → Not paid && due_date > now + 7 days

Icons:
- Won: 👑 or trophy icon (gold)
- Paid: ✓ (green)
- Partial: ◐ (yellow)
- Overdue: ⚠️ (red)
- Due: ○ (orange)
- Future: ○ (gray)

Layout:
- Horizontal ScrollView
- Each month is a 60x60 touchable box
- Month number at top
- Status icon in middle
- Due date below (small text)
- Active month highlighted with border
```

#### 1.2b Payment Table Component
```typescript
// File: Frontend/app/(admin)/customers/_components/PaymentTable.tsx
// New component - full payment history table

interface PaymentTableRow {
  monthNumber: number;
  schedule: PaymentSchedule;
  transactions: Transaction[];
  totalPaid: number;
  remaining: number;
  status: 'Full' | 'Partial' | 'Unpaid';
  isOverdue: boolean;
  isLate: boolean;
  daysLate: number;
  isWonMonth: boolean;
  isPostWin: boolean;
}

Columns:
1. Month # (with Won badge if applicable)
2. Due Date (IST format)
3. Amount Due (rupees)
4. Dividend Applied (rupees, if any)
5. Net Due (Amount - Dividend)
6. Amount Paid (rupees)
7. Remaining (rupees)
8. Status (badge: Full/Partial/Unpaid)
9. Actions (expand icon)

Expandable rows show:
- All transactions for that month
- Transaction date, amount, status, method, ref ID
- Failed attempts (strikethrough)
- Refunds (with refund icon)
- Late indicator with days late
- Notes from transaction

Edge cases handled:
✓ Multiple transactions per month (sum all)
✓ Failed transactions (show but don't count)
✓ Refunds (subtract from total paid)
✓ Late payments (show warning icon + days)
✓ Won month (special badge + prize info)
✓ Post-win period (purple tag)
```

#### 1.2c Integration
```typescript
// Update GroupsTab.tsx Payment History case:

{activeInnerTab === 'payment-history' && (
  <View style={styles.paymentHistoryContainer}>
    <MonthStrip
      schedules={groupSchedules}
      transactions={groupTransactions}
      durationMonths={selectedMembership.chit_groups.duration_months}
      onMonthClick={(month) => scrollToMonth(month)}
      wonMonth={wonMonth}
    />
    <PaymentTable
      schedules={groupSchedules}
      transactions={groupTransactions}
      membership={selectedMembership}
      wonMonth={wonMonth}
    />
  </View>
)}
```

**Real-time**: 🔄 Updates via existing subscription

---

### 1.3 Auction History Inner Tab (Per-Group)
**Status**: Placeholder → Full Implementation  
**Estimated Lines**: ~150  
**Dependencies**: None

**Implementation**:
```typescript
// Update GroupsTab.tsx Auction History case

Features:
✓ Table of all auctions for THIS group only
✓ Columns: Cycle, Date, Status, Winner, Prize, Discount, Participation
✓ Participation badge: Won / Bid / Did Not Bid
✓ Filter options: All / Only My Participation
✓ Chronological order (latest first)

Data filtering:
const groupAuctions = auctions.filter(
  a => a.chit_group_id === selectedMembership.chit_group_id
);

const myParticipations = participants.filter(
  p => groupAuctions.some(a => a.id === p.auction_id)
);

For each auction:
- Check if customer won (winner_member_id === membership.id)
- Check if customer participated (participant record exists)
- Calculate dividend share for this customer
- Show prize amount if won

Visual:
- Green Won badge with prize amount
- Blue Bid badge
- Gray Did Not Bid text
- Yellow upcoming/live status
- Green completed status
```

**Real-time**: ⚠️ Not subscribed (auctions change infrequently)

---

### 1.4 Documents Inner Tab
**Status**: Placeholder → Placeholder (DB table missing)  
**Action**: Keep placeholder, update message

```typescript
{activeInnerTab === 'documents' && (
  <View style={styles.placeholderCard}>
    <Text style={styles.placeholderTitle}>Documents Module Coming Soon</Text>
    <Text style={styles.placeholderText}>
      Will display KYC documents (Aadhaar, PAN), signed agreements, 
      and nominee forms once the customer_documents table is created.
      {'\n\n'}
      Required table: customer_documents
      Required columns: id, customer_id, document_type, file_url, 
      uploaded_at, verified_status
    </Text>
  </View>
)}
```

---

### 1.5 Ledger Inner Tab
**Status**: Placeholder → Full Implementation  
**Estimated Lines**: ~200  
**Dependencies**: None

**Implementation**:
```typescript
// File: Frontend/app/(admin)/customers/_components/LedgerTab.tsx
// New component for running balance ledger

Interface:
interface LedgerEntry {
  date: string;
  description: string;
  debit: number; // money going out (installments paid)
  credit: number; // money coming in (dividends, prizes)
  balance: number; // running balance
  type: 'installment' | 'dividend' | 'prize' | 'refund' | 'adjustment';
  referenceId: string;
}

Logic:
1. Combine all transactions and schedule dividends
2. Sort by date chronologically
3. Calculate running balance (start at 0)
   - Debit: installment payments (decrease balance)
   - Credit: dividends, prizes (increase balance)
4. Display as scrollable table

Columns:
- Date (IST)
- Description (e.g., "Month 5 Installment", "Dividend for Cycle 3", "Auction Prize")
- Debit (red)
- Credit (green)
- Running Balance (bold)
- Type badge

Features:
- Running balance starts at 0
- Negative balance = customer owes money
- Positive balance = customer has credit
- Final balance = net position

Example entries:
| Date       | Description        | Debit  | Credit | Balance |
|------------|--------------------|--------|--------|---------|
| 2024-01-15 | Month 1 Installment| ₹5,000 |        | -₹5,000 |
| 2024-01-20 | Dividend (Cycle 1) |        | ₹500   | -₹4,500 |
| 2024-02-15 | Month 2 Installment| ₹5,000 |        | -₹9,500 |
```

**Real-time**: 🔄 Updates via existing subscription

---

## Phase 2: Payment Edge Cases (PRIORITY 2)

### 2.1 Partial Payment Detection
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// In row calculation:
const totalPaid = transactions
  .filter(t => 
    t.chit_member_id === schedule.chit_member_id &&
    (t.status === 'completed' || t.status === 'success') &&
    t.payment_type === 'installment'
  )
  .reduce((sum, t) => sum + t.amount, 0);

const status: PaymentStatus = 
  totalPaid >= schedule.amount ? 'Full' :
  totalPaid > 0 ? 'Partial' :
  'Unpaid';

// In expanded row:
{status === 'Partial' && (
  <View style={styles.partialWarning}>
    <Icon name="alert" />
    <Text>
      Partial payment: {formatPaise(totalPaid)} of {formatPaise(schedule.amount)} paid
    </Text>
    <Text>Remaining: {formatPaise(schedule.amount - totalPaid)}</Text>
  </View>
)}
```

### 2.2 Late Payment Detection
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// Calculate if payment was late:
const latestCompletedTx = transactions
  .filter(t => t.status === 'completed' && t.payment_type === 'installment')
  .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime())[0];

const isLate = latestCompletedTx && 
  new Date(latestCompletedTx.transaction_date) > new Date(schedule.due_date);

const daysLate = isLate ? 
  Math.floor(
    (new Date(latestCompletedTx.transaction_date).getTime() - new Date(schedule.due_date).getTime()) 
    / (24 * 60 * 60 * 1000)
  ) : 0;

// Display:
{isLate && (
  <View style={styles.lateIndicator}>
    <Icon name="clock-alert" color="#F59E0B" />
    <Text style={styles.lateText}>Paid {daysLate} days late</Text>
  </View>
)}
```

### 2.3 Failed-Then-Retried Handling
**Location**: PaymentTable.tsx expandable row  
**Status**: Not Handled → Implemented

```typescript
// In expanded row, show ALL transactions:
const allTransactionsForMonth = transactions
  .filter(t => matchesMonth(t, schedule.month_number))
  .sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

{allTransactionsForMonth.map(tx => (
  <View 
    key={tx.id} 
    style={[
      styles.transactionRow,
      tx.status === 'failed' && styles.failedTransaction
    ]}
  >
    <Text style={tx.status === 'failed' && styles.strikethrough}>
      {formatDateTimeIST(tx.transaction_date)}
    </Text>
    <Text>{formatPaise(tx.amount)}</Text>
    <StatusBadge status={tx.status} />
    {tx.notes && <Text style={styles.notes}>{tx.notes}</Text>}
  </View>
))}
```

### 2.4 Refund Handling
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// Calculate net paid (subtract refunds):
const completedPayments = transactions
  .filter(t => t.status === 'completed' && t.payment_type === 'installment')
  .reduce((sum, t) => sum + t.amount, 0);

const refunds = transactions
  .filter(t => t.status === 'refunded')
  .reduce((sum, t) => sum + t.amount, 0);

const netPaid = completedPayments - refunds;

// Display refunds in expanded row:
{transactions.filter(t => t.status === 'refunded').map(tx => (
  <View key={tx.id} style={styles.refundRow}>
    <Icon name="undo" color="#EF4444" />
    <Text style={styles.refundText}>
      Refunded: {formatPaise(tx.amount)} on {formatDateIST(tx.transaction_date)}
    </Text>
  </View>
))}
```

### 2.5 Won Cycle Detection
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// Determine won month:
const wonAuction = auctions.find(
  a => a.chit_group_id === membership.chit_group_id &&
       a.winner_member_id === membership.id
);
const wonMonth = wonAuction?.auction_number || null;

// In table row:
{schedule.month_number === wonMonth && (
  <View style={styles.wonBadge}>
    <Icon name="trophy" color="#FFD700" />
    <Text style={styles.wonText}>WON</Text>
  </View>
)}

// Show prize info:
{schedule.month_number === wonMonth && wonAuction && (
  <View style={styles.prizeInfo}>
    <Text>Prize Amount: {formatPaise(wonAuction.winner_prize_amount)}</Text>
    <Text>Net Due: {formatPaise(wonAuction.final_due_amount)}</Text>
  </View>
)}

// Mark post-win period:
{wonMonth && schedule.month_number > wonMonth && (
  <View style={styles.postWinBadge}>
    <Text style={styles.postWinText}>Post-Win</Text>
  </View>
)}
```

---

## Phase 3: Additional Edge Cases (PRIORITY 3)

### 3.1 Foreclosed Group Detection
**Location**: GroupsTab.tsx Summary tab  
**Status**: Not Handled → Implemented

```typescript
{selectedMembership.bid_status === 'foreclosed' && (
  <View style={styles.foreclosedAlert}>
    <Icon name="alert-circle" color="#EF4444" size={24} />
    <View>
      <Text style={styles.alertTitle}>Group Foreclosed</Text>
      <Text style={styles.alertText}>
        This chit group was foreclosed. Settlement details may apply.
      </Text>
      {/* TODO: Add foreclosure_date and reason if available in DB */}
    </View>
  </View>
)}

// In payment table, gray out future months:
<View style={[
  styles.row,
  isFutureAfterForeclosure && styles.rowGrayedOut
]}>
```

### 3.2 Manual Adjustment Detection
**Location**: PaymentTable.tsx expandable row  
**Status**: Not Handled → Implemented

```typescript
// Detect adjustments:
const adjustments = transactions.filter(
  t => t.payment_type === 'penalty' || 
       t.payment_type === 'adjustment' ||
       t.amount < 0
);

{adjustments.map(tx => (
  <View key={tx.id} style={styles.adjustmentRow}>
    <Icon name="edit" color="#F59E0B" />
    <Text style={styles.adjustmentLabel}>Manual Adjustment</Text>
    <Text>{formatPaise(Math.abs(tx.amount))}</Text>
    {tx.notes && (
      <Text style={styles.adjustmentReason}>Reason: {tx.notes}</Text>
    )}
  </View>
))}
```

### 3.3 Dividend Recalculation Detection
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// Calculate expected dividend:
const auction = auctions.find(
  a => a.chit_group_id === membership.chit_group_id &&
       a.auction_number === schedule.month_number
);

const memberCount = membership.chit_groups.duration_months;
const expectedDividend = auction ? auction.discount_amount / memberCount : 0;
const actualDividend = schedule.dividend_amount;

const isRecalculated = Math.abs(expectedDividend - actualDividend) > 1; // tolerance for rounding

{isRecalculated && (
  <View style={styles.recalcBadge}>
    <Icon name="calculator" />
    <Text>Dividend Recalculated</Text>
    <Text>Expected: {formatPaise(expectedDividend)}</Text>
    <Text>Actual: {formatPaise(actualDividend)}</Text>
  </View>
)}
```

### 3.4 Missing Schedule Handling
**Location**: PaymentTable.tsx  
**Status**: Not Handled → Implemented

```typescript
// Find unlinked transactions:
const allMonthsWithSchedules = schedules.map(s => s.month_number);
const unlinkedTransactions = transactions.filter(t => 
  t.payment_type === 'installment' &&
  !schedules.some(s => matchesMonth(t, s.month_number))
);

// Below main table:
{unlinkedTransactions.length > 0 && (
  <View style={styles.unlinkedSection}>
    <Text style={styles.sectionTitle}>Unlinked Payments</Text>
    <Text style={styles.sectionSubtitle}>
      These payments could not be matched to a specific month
    </Text>
    {unlinkedTransactions.map(tx => (
      <View key={tx.id} style={styles.unlinkedRow}>
        <Text>{formatDateIST(tx.transaction_date)}</Text>
        <Text>{formatPaise(tx.amount)}</Text>
        <TouchableOpacity 
          style={styles.linkButton}
          onPress={() => handleLinkToMonth(tx.id)}
        >
          <Text style={styles.linkButtonText}>Link to Month</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
)}

// For missing schedules:
const missingMonths = Array.from(
  { length: membership.chit_groups.duration_months },
  (_, i) => i + 1
).filter(month => !schedules.some(s => s.month_number === month));

{missingMonths.length > 0 && (
  <View style={styles.missingSchedulesSection}>
    <Text style={styles.sectionTitle}>Missing Schedules</Text>
    {missingMonths.map(month => (
      <View key={month} style={styles.missingRow}>
        <Text>Month {month}: No schedule found</Text>
        <TouchableOpacity 
          style={styles.createButton}
          onPress={() => handleCreateSchedule(month)}
        >
          <Text style={styles.createButtonText}>Create Schedule</Text>
        </TouchableOpacity>
      </View>
    ))}
  </View>
)}
```

---

## Phase 4: Export & Activity (PRIORITY 4)

### 4.1 Export to CSV
**Location**: PaymentTable.tsx  
**Status**: Not Implemented → Implemented

```typescript
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const exportToCSV = async () => {
  // Build CSV content
  const headers = 'Month,Due Date,Amount Due,Dividend,Net Due,Amount Paid,Remaining,Status\n';
  
  const rows = schedules.map(schedule => {
    const monthTxs = transactions.filter(t => matchesMonth(t, schedule.month_number));
    const totalPaid = monthTxs
      .filter(t => t.status === 'completed')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const remaining = Math.max(0, schedule.amount - totalPaid);
    const status = totalPaid >= schedule.amount ? 'Full' : totalPaid > 0 ? 'Partial' : 'Unpaid';
    
    return [
      schedule.month_number,
      formatDateIST(schedule.due_date),
      (schedule.amount / 100).toFixed(2),
      (schedule.dividend_amount / 100).toFixed(2),
      ((schedule.amount - schedule.dividend_amount) / 100).toFixed(2),
      (totalPaid / 100).toFixed(2),
      (remaining / 100).toFixed(2),
      status
    ].join(',');
  }).join('\n');
  
  const csv = headers + rows;
  
  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `customer-${customerId}-group-${groupName}-payments-${timestamp}.csv`;
  const filepath = `${FileSystem.documentDirectory}${filename}`;
  
  await FileSystem.writeAsStringAsync(filepath, csv, { encoding: FileSystem.EncodingType.UTF8 });
  
  // Share file
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(filepath);
  }
};

// Button in UI:
<TouchableOpacity style={styles.exportButton} onPress={exportToCSV}>
  <Icon name="download" />
  <Text style={styles.exportButtonText}>Export to CSV</Text>
</TouchableOpacity>
```

### 4.2 Activity Timeline (Requires DB Table)
**Status**: Placeholder → Database Required

**Action**: Document the required table schema

```sql
-- Required table: audit_events
CREATE TABLE audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  event_type VARCHAR(50) NOT NULL, 
  -- transaction_created, transaction_updated, transaction_failed,
  -- auction_joined, auction_left, auction_won,
  -- schedule_created, schedule_updated,
  -- membership_created, membership_updated,
  -- kyc_status_changed
  entity_type VARCHAR(50), -- transaction, auction, schedule, membership
  entity_id UUID,
  description TEXT,
  metadata JSONB, -- additional context
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_audit_events_customer ON audit_events(customer_id, created_at DESC);
```

**Implementation** (once table exists):
```typescript
// New hook: Frontend/lib/hooks/admin/useCustomerActivity.ts
export function useCustomerActivity(customerId: string) {
  return useInfiniteQuery({
    queryKey: ['admin', 'customer-activity', customerId],
    queryFn: async ({ pageParam = 0 }) => {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(pageParam, pageParam + 19);
      
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) => 
      lastPage.length === 20 ? pages.length * 20 : undefined,
  });
}

// Component:
const { data, fetchNextPage, hasNextPage } = useCustomerActivity(customerId);

const allEvents = data?.pages.flat() || [];

<FlatList
  data={allEvents}
  renderItem={({ item }) => <ActivityItem event={item} />}
  onEndReached={() => hasNextPage && fetchNextPage()}
  onEndReachedThreshold={0.5}
/>
```

---

## Phase 5: Real-Time Optimization (PRIORITY 5)

### 5.1 Add More Subscriptions
**Location**: useCustomerDetailData.ts  
**Current**: Only subscribed to chit_member_transactions  
**Add**: payment_schedules for paid status updates

```typescript
// Add second subscription:
useEffect(() => {
  if (!customerId || memberIds.length === 0) return;

  const txChannel = supabase
    .channel(`customer-tx-${customerId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'chit_member_transactions',
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer-detail', customerId] });
    })
    .subscribe();

  const scheduleChannel = supabase
    .channel(`customer-schedule-${customerId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'payment_schedules',
      filter: `chit_member_id=in.(${memberIds.join(',')})`,
    }, () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'customer-detail', customerId] });
    })
    .subscribe();

  return () => {
    supabase.removeChannel(txChannel);
    supabase.removeChannel(scheduleChannel);
  };
}, [customerId, memberIds, queryClient]);
```

### 5.2 Optimize Refetch Strategy
**Location**: useCustomerDetailData.ts  
**Current**: Full refetch on any change  
**Optimize**: Merge updates instead of full refetch

```typescript
// Instead of invalidateQueries, update cache directly:
.on('postgres_changes', {
  event: 'INSERT',
  schema: 'public',
  table: 'chit_member_transactions',
}, (payload) => {
  queryClient.setQueryData(
    ['admin', 'customer-detail', customerId],
    (old: CustomerDetailData) => ({
      ...old,
      transactions: [payload.new, ...old.transactions],
      kpiMetrics: recalculateKPIs(old, payload.new),
    })
  );
})
```

---

## Database Schema Verification

### ✅ Existing Tables (Confirmed)
- customers
- chit_members
- chit_groups
- payment_schedules
- chit_member_transactions
- auctions
- auction_participants
- auction_bids
- auction_events
- auction_reminders
- member_device_tokens
- profiles

### ❌ Missing Tables (Required for Full Features)
- **audit_events** - Required for Activity timeline
- **customer_documents** - Required for Documents tab
- **webhook_events** - Required for webhook diagnostics
- **refunds** - Nice to have for detailed refund tracking

---

## Testing Checklist

### Unit Tests
- [ ] formatPaise with various paise values
- [ ] formatDateIST with UTC timestamps
- [ ] deriveRiskLevel with various inputs
- [ ] KPI calculations (lifetimePaid, outstanding, onTimePercentage)
- [ ] Payment status determination (Full/Partial/Unpaid)
- [ ] Late payment detection
- [ ] Dividend calculation

### Integration Tests
- [ ] Real-time subscription triggers refetch
- [ ] Payment table updates when new transaction arrives
- [ ] Month strip updates colors on payment
- [ ] Filters work correctly (by group, by status)
- [ ] Expandable rows show all transactions
- [ ] Export CSV generates correct file

### Manual Tests
- [ ] Test with customer having 0 groups
- [ ] Test with customer having 1 group
- [ ] Test with customer having 10+ groups
- [ ] Test with 50+ payment records (virtualization)
- [ ] Test partial payment display
- [ ] Test late payment display
- [ ] Test failed-then-succeeded payment
- [ ] Test refund display
- [ ] Test won cycle display
- [ ] Test foreclosed group display
- [ ] Test manual adjustment display
- [ ] Test unlinked transaction display
- [ ] Test missing schedule display

---

## Performance Targets
- Initial load: < 2 seconds
- Tab switch: < 500ms
- Real-time update: < 100ms
- Payment table scroll: 60fps
- CSV export: < 3 seconds for 100 rows

---

## Deployment Checklist
- [ ] All TypeScript errors resolved
- [ ] All ESLint warnings addressed
- [ ] Component size limits respected (<300 lines)
- [ ] Real-time subscriptions properly cleaned up
- [ ] Error boundaries implemented
- [ ] Loading states for all async operations
- [ ] Empty states for all data lists
- [ ] Accessibility labels added
- [ ] Performance tested with large datasets
- [ ] Documentation updated

---

## Estimated Timeline
- Phase 1 (Groups Inner Tabs): 2-3 days
- Phase 2 (Payment Edge Cases): 1-2 days
- Phase 3 (Additional Edge Cases): 1 day
- Phase 4 (Export & Activity): 1 day (Activity depends on DB)
- Phase 5 (Real-Time Optimization): 0.5 days
- **Total**: 5-7 days for complete implementation

---

## Next Immediate Actions
1. ✅ Audit complete (DONE - see FEATURE_AUDIT.md)
2. ▶️ **START HERE**: Implement GroupSummaryInnerTab
3. Implement MonthStrip component
4. Implement PaymentTable component
5. Handle all payment edge cases
6. Implement Ledger tab
7. Implement per-group Auction History
8. Add Export CSV
9. Optimize real-time updates
10. Add database tables for remaining features
