# UI Updates Needed to Match Admin Design System

## Issues Identified from Screenshots

1. **Color Palette Mismatch** - Currently using wrong colors
2. **Typography** - Not using consistent SpaceGrotesk/Inter fonts
3. **Empty Tabs** - Payments, Auctions, Diagnostics tabs are just placeholder text
4. **Layout Structure** - Not following the bento card grid pattern
5. **Badges** - Wrong style and colors

## Correct Design System (from existing admin pages)

### Colors
```typescript
const COLORS = {
  primary: '#005E7D',          // cyan-800 (buttons, active states)
  primaryLight: '#C1E8FF',     // cyan-100 (backgrounds)
  secondary: '#006A65',        // teal (accents)
  accent: '#54FAEF',           // cyan bright (FAB, highlights)
  textPrimary: '#0B1C30',      // Almost black (headings)
  textSecondary: '#64748B',    // slate-500 (body text)
  textTertiary: '#94A3B8',     // slate-400 (labels)
  border: '#E2E8F0',           // slate-200 (borders)
  borderLight: '#F1F5F9',      // slate-100 (dividers)
  bgPrimary: '#FFFFFF',        // white (cards)
  bgSecondary: '#F8FAFC',      // slate-50 (page background)
  bgTertiary: '#F8F9FF',       // Very light blue-gray
  success: '#10B981',          // emerald-500
  warning: '#F59E0B',          // amber-500
  error: '#EF4444',            // red-500
};
```

### Typography
```typescript
// Headings
fontFamily: 'SpaceGrotesk_700Bold'
fontFamily: 'SpaceGrotesk_600SemiBold'

// Body
fontFamily: 'Inter_700Bold'      // Strong emphasis
fontFamily: 'Inter_600SemiBold'  // Medium emphasis
fontFamily: 'Inter_500Medium'    // Regular+
fontFamily: 'Inter_400Regular'   // Body text
```

### Card Styles
```typescript
card: {
  backgroundColor: '#FFFFFF',
  borderRadius: 18,  // or 20 for larger cards
  padding: 18,       // or 24 for larger cards
  borderWidth: 1,
  borderColor: '#F1F5F9',
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.04,
  shadowRadius: 8,
  elevation: 2,
}
```

### Badge Styles
```typescript
// KYC Verified
{ backgroundColor: '#F0FDF4', borderColor: '#DCFCE7', color: '#16A34A' }

// KYC Pending
{ backgroundColor: '#FFFBEB', borderColor: '#FEF3C7', color: '#D97706' }

// Status badges
badgeStyle: {
  paddingHorizontal: 12,
  paddingVertical: 4,
  borderRadius: 100,
  borderWidth: 1,
}
```

## Required Changes Per Component

### 1. CustomerHeader.tsx
**Issues**:
- Avatar background should be `#005E7D` not `#0EA5E9`
- Badge colors wrong
- Button colors wrong (`#0EA5E9` should be `#005E7D`)

**Fix**:
```typescript
// Avatar
backgroundColor: '#005E7D'

// Buttons
backgroundColor: '#005E7D'  // primary
backgroundColor: '#54FAEF'  // accent (if needed)

// Badge backgrounds
KYC verified: '#F0FDF4'
Risk medium: '#FFFBEB'
```

### 2. KPIStrip.tsx
**Issues**:
- Background color should be white, not gray
- Label colors need adjustment
- Value colors need conditional logic

**Fix**:
```typescript
container: {
  backgroundColor: '#FFFFFF',  // NOT #F8FAFC
  borderBottomWidth: 1,
  borderBottomColor: '#F1F5F9',
  padding: 20,
}

kpiLabel: {
  fontFamily: 'Inter_600SemiBold',
  fontSize: 11,
  color: '#94A3B8',
  letterSpacing: 0.8,
}

kpiValue: {
  fontFamily: 'SpaceGrotesk_700Bold',
  fontSize: 24,  // larger
  color: '#0B1C30',
}
```

### 3. OuterTabs.tsx
**Issues**:
- Active tab color should be `#005E7D`
- Border style needs to match

**Fix**:
```typescript
tabActive: {
  borderBottomColor: '#005E7D',  // NOT #0EA5E9
}

tabTextActive: {
  color: '#005E7D',
}
```

### 4. OverviewTab.tsx
**Issues**:
- Card padding and styling
- Health snapshot needs bento grid layout
- Colors throughout

**Fix**: Use the bento grid pattern from dashboard.tsx with proper card styling

### 5. GroupsTab.tsx
**Issues**:
- Group chip active color should be `#005E7D`
- Card styling needs work
- Empty state styling

**Fix**:
```typescript
groupChipActive: {
  backgroundColor: '#005E7D',  // NOT #0EA5E9
  borderColor: '#005E7D',
}
```

### 6. PaymentsTab.tsx - COMPLETELY MISSING
**Should have**:
- Summary stats in bento cards
- Month strips for each group
- Transaction table with filters
- NOT just placeholder text

### 7. AuctionsTab.tsx - COMPLETELY MISSING
**Should have**:
- Timeline cards like auctions/index.tsx
- Filter chips (All, Won, Outbid, Did Not Participate)
- Auction outcome cards
- NOT just placeholder text

### 8. DiagnosticsTab.tsx - MOSTLY MISSING
**Should have**:
- Razorpay orders table (can parse from transactions.notes)
- Failed payments list
- Data quality issues list
- NOT just placeholder text

## Immediate Action Items

### Priority 1: Fix Colors and Typography
Replace all instances of:
- `#0EA5E9` → `#005E7D`
- `#DCFCE7` (already correct for success)
- Font sizes too small → increase by 2-4px
- Use SpaceGrotesk for all numbers and headings

### Priority 2: Rebuild Empty Tabs
1. **PaymentsTab**: Create actual cross-group payment view with:
   - 4 stat cards in 2x2 grid (Paid This Year, Pending, Overdue, Failed)
   - Month strip component per group
   - Transaction table

2. **AuctionsTab**: Create auction timeline with:
   - Filter chips at top
   - Auction cards showing date, group, outcome, amounts
   - Use same card style as auctions/index.tsx

3. **DiagnosticsTab**: Create diagnostic view with:
   - Razorpay orders section
   - Failed payments section
   - Data quality section

### Priority 3: Polish Existing Tabs
1. Overview tab - use bento grid layout
2. Groups tab - fix chip colors and card styles
3. Add proper loading states
4. Add proper empty states

## Quick Win: Color Replace Script

Run this find-replace across all customer detail files:

| Find | Replace |
|------|---------|
| `#0EA5E9` | `#005E7D` |
| `#F8FAFC` (in KPI strip background) | `#FFFFFF` |
| `borderRadius: 12` | `borderRadius: 18` |
| `padding: 16` | `padding: 18` |
| `fontSize: 14` (for headings) | `fontSize: 16` |
| `fontSize: 13` (for labels) | `fontSize: 12` |

## Example: Correct Card Style

```typescript
// From dashboard.tsx and auctions/index.tsx
const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  
  cardLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
    color: '#94A3B8',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  
  cardValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 24,
    color: '#0B1C30',
  },
  
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
  },
  
  statusVerified: {
    backgroundColor: '#F0FDF4',
    borderColor: '#DCFCE7',
  },
  
  statusVerifiedText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    color: '#16A34A',
    letterSpacing: 0.5,
  },
});
```

## Next Steps

1. **Create a shared constants file** for admin colors/styles
2. **Extract common components** (StatCard, Badge, etc.)
3. **Build out the empty tabs** properly
4. **Test on actual device** to match screenshots exactly

Would you like me to proceed with implementing these fixes?
