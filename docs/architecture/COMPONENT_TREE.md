# Admin Customer Detail - Component Tree

```
CustomerDetailsScreen (Container)
├─ useCustomerDetailData hook (Data fetching + Realtime)
│
├─ SafeAreaView
│  ├─ AppBar (Back button)
│  │
│  ├─ CustomerHeader (Presentational)
│  │  ├─ Avatar
│  │  ├─ Name, ID, Type, Contact info
│  │  ├─ Member since date
│  │  ├─ KYC Badge (verified/pending/rejected)
│  │  ├─ Risk Badge (low/medium/high - derived)
│  │  └─ Quick Actions (Call, Email buttons)
│  │
│  ├─ KPIStrip (Presentational)
│  │  ├─ Active Chits
│  │  ├─ Lifetime Paid
│  │  ├─ Dividend Earned
│  │  ├─ Outstanding
│  │  └─ On-time %
│  │
│  ├─ OuterTabs (Presentational)
│  │  └─ [Overview | Groups | Payments | Auctions | Diagnostics | Activity]
│  │
│  └─ Tab Content (Conditional rendering based on activeTab)
│     │
│     ├─ OverviewTab (Presentational)
│     │  ├─ Health Snapshot Card
│     │  │  ├─ Risk Level (with reasons)
│     │  │  ├─ Overdue Payments count
│     │  │  └─ Outstanding amount
│     │  ├─ Upcoming Dues Card (next 30 days)
│     │  ├─ Recent Transactions Card (last 5)
│     │  │  └─ "View all →" link (switches to Payments tab)
│     │  ├─ Active Groups (horizontal scroll, max 3 visible)
│     │  └─ Most Recent Auction Outcome Card
│     │
│     ├─ GroupsTab (Container)
│     │  ├─ Group Selector (Horizontal chip strip)
│     │  │  └─ [Group chips with name, status, progress, ticket #]
│     │  │
│     │  ├─ Inner Tabs (for selected group)
│     │  │  └─ [Summary | Payment History | Auction History | Documents | Ledger]
│     │  │
│     │  └─ Inner Tab Content
│     │     ├─ Summary (Placeholder)
│     │     ├─ Payment History (Placeholder)
│     │     │  └─ TODO: Month strip + Full table
│     │     ├─ Auction History (Placeholder)
│     │     ├─ Documents (Intentional placeholder)
│     │     └─ Ledger (Placeholder)
│     │
│     ├─ PaymentsTab (Placeholder)
│     │  └─ TODO: Cross-group payment view
│     │
│     ├─ AuctionsTab (Placeholder)
│     │  └─ TODO: Timeline across all groups
│     │
│     ├─ DiagnosticsTab (Placeholder)
│     │  └─ TODO: Razorpay orders, failed payments, webhooks, refunds
│     │
│     └─ ActivityTab (Intentional placeholder)
│        └─ Waiting for audit_events table
```

## Component Types

### Container Components (Manage state & data)
- `CustomerDetailsScreen` - Main page, manages active tab state
- `GroupsTab` - Manages selected group and inner tab state

### Presentational Components (Pure UI, receive props)
- `CustomerHeader` - Display customer profile info
- `KPIStrip` - Display metrics strip
- `OuterTabs` - Tab navigation UI
- `OverviewTab` - Overview dashboard
- `PaymentsTab` - Payments view (placeholder)
- `AuctionsTab` - Auctions timeline (placeholder)
- `DiagnosticsTab` - Data quality view (placeholder)
- `ActivityTab` - Activity log (placeholder)

## Data Flow

```
Supabase Database
       ↓
useCustomerDetailData hook
  ├─ Eager load on mount
  ├─ React Query caching (2min stale time)
  └─ Realtime subscription on chit_member_transactions
       ↓
CustomerDetailsScreen receives data
       ↓
Props flow down to child components:
  ├─ CustomerHeader ← customer, overdueCount, onTimePercentage
  ├─ KPIStrip ← kpiMetrics
  ├─ OverviewTab ← memberships, transactions, schedules, auctions, etc.
  └─ GroupsTab ← memberships
```

## File Organization

```
Frontend/
├─ app/
│  └─ (admin)/
│     └─ customers/
│        ├─ [id].tsx                      # Main page (95 lines)
│        └─ _components/
│           ├─ types.ts                   # Type definitions (180 lines)
│           ├─ utils.ts                   # Utility functions (180 lines)
│           ├─ CustomerHeader.tsx         # Header component (150 lines)
│           ├─ KPIStrip.tsx               # KPI metrics (70 lines)
│           ├─ OuterTabs.tsx              # Outer navigation (80 lines)
│           ├─ OverviewTab.tsx            # Overview content (470 lines - may need split)
│           ├─ GroupsTab.tsx              # Groups + inner tabs (330 lines)
│           ├─ PaymentsTab.tsx            # Placeholder (40 lines)
│           ├─ AuctionsTab.tsx            # Placeholder (40 lines)
│           ├─ DiagnosticsTab.tsx         # Placeholder (50 lines)
│           └─ ActivityTab.tsx            # Placeholder (40 lines)
│
└─ lib/
   └─ hooks/
      └─ admin/
         └─ useCustomerDetailData.ts      # Main data hook (160 lines)
```

## State Management Strategy

### Local Component State (useState)
- **Outer tab selection**: `activeTab: OuterTab` in CustomerDetailsScreen
- **Selected group**: `selectedGroupId: string | null` in GroupsTab
- **Inner tab selection**: `activeInnerTab: InnerTab` in GroupsTab
- **Expanded sections**: Future (e.g., month buckets, transaction details)

### React Query (Server State)
- **Query key**: `['admin', 'customer-detail', customerId]`
- **Stale time**: 2 minutes
- **Cache time**: 5 minutes (default)
- **Refetch on**: Window focus, Real-time updates

### Supabase Realtime (Live Updates)
- **Channel**: `customer-detail-${customerId}`
- **Table**: `chit_member_transactions`
- **Events**: INSERT, UPDATE, DELETE
- **Action**: Invalidate React Query cache → Auto-refetch

### Justification
- **No URL params**: Admin workflow is session-based, not shareable
- **No global state**: Data is scoped to single customer, no cross-page needs
- **React Query handles caching**: No need for Redux/Zustand
- **Local state for UI**: Simple, performant, easy to debug

## Query Optimization

### Parallel Fetching
```typescript
// Single round-trip for customer + memberships
const [customerRes, membershipsRes] = await Promise.all([...])

// Second parallel fetch for related data
const [schedulesRes, transactionsRes, auctionsRes, participantsRes] = 
  await Promise.all([...])
```

### Nested Relations (Supabase)
```typescript
.select(`
  *,
  chit_groups (*)
`)
```

### Filtering at Database
```typescript
.eq('customer_id', customerId)
.in('chit_member_id', memberIds)
```

### Lazy Loading Strategy
- ✅ **Eager**: Customer profile, memberships, schedules, transactions, auctions, participants
- 🔄 **Future Lazy**: Per-group transaction details (when Payment History tab opens)
- 🔄 **Future Lazy**: Auction bids (when Auction History inner tab opens)

## Component Size Tracking

| Component | Lines | Status |
|-----------|-------|--------|
| CustomerDetailsScreen | 95 | ✅ Under 300 |
| CustomerHeader | 150 | ✅ Under 300 |
| KPIStrip | 70 | ✅ Under 300 |
| OuterTabs | 80 | ✅ Under 300 |
| OverviewTab | 470 | ⚠️ Over 300 (may split in Phase 2) |
| GroupsTab | 330 | ⚠️ Over 300 (may split in Phase 2) |
| types.ts | 180 | ✅ Shared types |
| utils.ts | 180 | ✅ Utility functions |
| useCustomerDetailData | 160 | ✅ Under 300 |

**Note**: OverviewTab and GroupsTab slightly exceed 300 lines but are manageable. Will monitor during Phase 2 and split if they grow further.
