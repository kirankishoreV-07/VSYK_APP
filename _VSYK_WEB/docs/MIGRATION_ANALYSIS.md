# VSYK Web Application — Migration Analysis & Plan

> Phase deliverable: **Analyze → Document → Plan** (implementation follows, in tracked increments).
> Source of truth: the mobile app at `../Frontend` (Expo/React Native), the `../Backend` Node service, the SQL migrations in `../Frontend/supabase/migrations`, and the team's root-level `*.md` docs. **Read-only** — only `_VSYK_WEB` is edited.

---

## 0. Executive Summary

VSYK is a **digital chit-fund management platform**. Members join *chit groups* (rotating savings circles), pay monthly installments, and each cycle a monthly *auction* decides who receives the pot. There are two distinct experiences:

- **Member app** — 5 tabs (Home dashboard, My Chits, Auctions, Wallet, Profile) + detail/sub pages.
- **Admin portal** — Dashboard, Customers (deep 6-tab CRM), Groups, Live Auctions, Reports, Settings.

The web app (`_VSYK_WEB`, Next.js 14 App Router + Tailwind) currently ships only the **marketing site**. The migration adds the authenticated application behind a new **`/login`** gateway (first change — done), reusing the **same Supabase backend** as mobile.

**Shared backend (reuse exactly):**
- URL: `https://rmbyjndeaqaupgndhotl.supabase.co`
- Anon key: `sb_publishable_6iofTco4NnAzYShwOyzEvA_7wDbooCh`
- Optional Node API: `http://localhost:5000` (Razorpay, FCM, auction scheduler)

---

## 1. Application Architecture

### 1.1 Feature Inventory

**Member-facing**
- Phone-based login; portfolio dashboard (total value, earnings, active chits, health/KYC score).
- My Chits: searchable/filterable list of memberships; chit detail with full month-by-month payment timeline.
- Payments: online (Razorpay) for *accounted* groups; partial payments (month "Paid" only when cumulative ≥ due); cash status (read-only) for *unaccounted* groups.
- Auctions: upcoming list, live bidding, outcome history (Won / Bid / No Bid), dividend/discount shown.
- Wallet: transaction/payment history.
- Profile: editable info, language (EN/HI/TA), nominees, foreclosure request, insights, logout.

**Admin-facing**
- Dashboard: KPIs, activity feed, collection pie chart (last 6 months).
- Customers: list + deep detail with 6 tabs — Overview, Groups (5 inner tabs: Summary, Payment History, Auction History, Documents*, Ledger), Payments, Auctions, Diagnostics, Activity*.
- Groups: list + detail + member management + per-member payment modals.
- Live Auctions: real-time bid monitoring, winner declaration, settlement.
- Reports + Settings.
- Record cash collections (denomination breakdown) and prize settlements (partial/full).

(*) Documents / Activity tabs are placeholders pending `customer_documents` / `audit_events` tables.

### 1.2 Screen Inventory (mobile routes → file)

| Area | Route | File |
|---|---|---|
| Auth | `/login`, `/onboarding` | `Frontend/app/(auth)/*` |
| Tabs | Home | `Frontend/app/(tabs)/index.tsx` |
| Tabs | My Chits | `(tabs)/chits.tsx` |
| Tabs | Auctions | `(tabs)/auctions.tsx` |
| Tabs | Wallet | `(tabs)/wallet.tsx` |
| Tabs | Profile (+ nominees, foreclosure, insights) | `(tabs)/profile.tsx`, `(tabs)/profile/*` |
| Detail | Chit detail / payment | `(tabs)/chit/[id].tsx` |
| Detail | History | `(tabs)/history/[id].tsx` |
| Admin | Dashboard | `(admin)/dashboard.tsx` |
| Admin | Customers list + `[id]` (+ 6 sub-tabs) | `(admin)/customers/*` |
| Admin | Groups list + `[id]` + members | `(admin)/groups/*` |
| Admin | Auctions + live | `(admin)/auctions/*` |
| Admin | Reports / Settings | `(admin)/reports.tsx`, `(admin)/settings.tsx` |

### 1.3 Navigation / Auth Model
- **Members** log in by phone (10 digits); session held in `MemberSessionContext` (AsyncStorage on mobile → cookie/localStorage on web).
- **Admin** uses demo credentials in `admin_users` (username `vsyk2026` / password `vsyk@2026`, migration 007). Web should gate the admin area behind this and never expose it client-side beyond what mobile already does.
- Data fetching via React Query with ~20s refetch + Supabase realtime on `chit_member_transactions`.

---

## 2. UI / Design System (extracted from mobile)

**Colors** — already mirrored in `_VSYK_WEB/tailwind.config.ts`:
- Primary `#01789E` (deep teal-navy) · Secondary/teal `#10D7CD` · accent glow `#54FAEF`.
- Background `#F8FAFC` · surface `#FFFFFF` · mute `#F1F5F9` · deep `#E2E8F0`.
- Ink `#0B1C30` / soft `#213145` / mute `#3F484E` / fade `#64748B`.
- Status: error `#BA1A1A`, success `#15803D`, warning/bidding `#F59E0B`.

**Typography** — SpaceGrotesk (display/headings), Inter (body/UI), HindMadurai (Tamil/Hindi). 4px spacing grid. Radii 4→full. Blue-tinted premium shadows (already in web config as `brand-*`/`premium`).

**Components to build (web equivalents):** Button (primary/outline/FAB), Card (chit/stat/health), Input (text/phone/OTP), Modal/Dialog, Bottom-sheet→Drawer, Badge/status pill, Progress bar + health ring, Table (admin), Tabs/segmented control, Empty state, Skeleton, Toast/Alert. Icons: `lucide-react` (already a dependency).

---

## 3. Backend Analysis (Supabase)

**Core tables (final state after 30 migrations):** `profiles`, `customers`, `chit_groups` (`accounting_type` accounted/unaccounted), `chit_members` (`ticket_number`, `bid_status`), `payment_schedules`, `chit_member_transactions` (installment/penalty/registration; completed/failed/refunded), `auctions` (winner/settlement fields), `auction_bids`, `auction_participants`, `auction_events`, `cash_collections` (denomination_500..10), `auction_prize_settlements`, `nominees`, `foreclosure_requests`, `member_device_tokens`, `wallet_transactions`, `admin_users`.

**Views:** `member_dashboard_stats`, `v_upcoming_auctions`, `v_member_auction_payments`, `v_customer_cash_collections`, `v_customer_prize_settlements`.

**RLS:** Migration 017 opens RLS (`USING (true)`) for demo on the financial tables — so the anon key can read/write directly (same as mobile). Money stored as integer **paise**; dates UTC, displayed IST.

**Key business logic:**
- Highest bid wins (mig 025); bids must exceed current and meet min (026).
- Cycle due = auction `final_due_amount`/`installment_due` once auction `completed`, else `monthly_installment` fallback.
- Partial payment: schedule `paid` only when Σ completed txns ≥ due; net = completed − refunded.
- Cash groups recorded in `cash_collections`; prizes in `auction_prize_settlements` (partial allowed; remaining = `winner_prize_amount` − Σ paid).

---

## 4. Migration Plan (per mobile screen → web)

| Mobile screen | Purpose | Data source | Web implementation | Desktop UX upgrade |
|---|---|---|---|---|
| Login / Onboarding | Auth gateway | `customers`/`profiles`, `admin_users` | `/login` route + session context | Split hero + form; remember device |
| Home dashboard | Portfolio overview | `member_dashboard_stats`, schedules, auctions | `/app` dashboard grid | Multi-column bento, charts use width |
| My Chits | Membership list | `chit_members`+`chit_groups` | `/app/chits` data table/cards | Sortable table + filters sidebar |
| Chit detail | Month timeline + pay | schedules, txns, auctions | `/app/chits/[id]` | Month strip + side ledger panel |
| Auctions | Live bidding | `auctions`, `auction_bids` (realtime) | `/app/auctions` | Live board + bid panel side-by-side |
| Wallet | Payment history | txns, `wallet_transactions` | `/app/wallet` | Filterable ledger table |
| Profile (+sub) | Account mgmt | `profiles`, `nominees`, `foreclosure_requests` | `/app/profile/*` | Settings layout w/ left nav |
| Admin dashboard | KPIs + charts | aggregates | `/admin` | Wide KPI strip + charts |
| Admin customers | CRM 6-tab | many tables | `/admin/customers[/id]` | Master-detail, persistent tabs |
| Admin groups | Group mgmt | groups, members | `/admin/groups[/id]` | Table + slide-over member editor |
| Admin live auctions | Monitor/settle | auctions realtime | `/admin/auctions/live` | Live grid + settlement modal |
| Reports / Settings | Analytics/config | aggregates | `/admin/reports`, `/admin/settings` | Dashboards + export |

### Build status (implemented)
- **Member app** (`/login`, `/app/*`): dashboard, chits, chit detail, auctions, wallet, profile — live data. ✅
- **Admin portal** (`/admin/*`): dashboard (AUM/members/collection/auctions/dividends + activity), customers list + detail (KPI strip + Overview/Groups/Payments/Auctions tabs), groups list + detail (Members/Auctions/Details tabs), auctions monitor, reports, settings — live data. ✅
- Admin login uses `admin_users` (`vsyk2026`); session in `localStorage` (`vsyk_admin`), gated by `AdminShell`.
- **Not yet:** create/edit forms (new customer, new group, record cash collection / settlement), realtime auction bidding, i18n.

### Implementation sequencing
1. **Foundation:** add `@supabase/supabase-js` + `@tanstack/react-query`; create `lib/supabase.ts`, env, session context, money/date utils, shared UI primitives. *(Decision needed: how to supply Supabase env — see Open Questions.)*
2. **Auth:** `/login` page + member/admin session, route protection for `/app` and `/admin`.
3. **Member core:** dashboard → chits → chit detail → auctions → wallet → profile.
4. **Admin core:** dashboard → customers (+tabs) → groups → live auctions → reports/settings.
5. **Parity pass:** realtime, partial-payment/cash logic, settlements, i18n, validation.

---

## 5. Open Questions / Risks
- **Env handling:** commit a `.env.local` in `_VSYK_WEB` with the existing anon key (matches mobile, demo-open RLS), or inject at runtime? Default: `.env.local` since RLS is already public for demo.
- **Payments:** Razorpay needs the Node backend + keys; web checkout may be deferred (read-only payment history first).
- **Admin security:** demo plaintext creds — replicate as-is for parity, flag for production hardening.
- **Placeholders:** Documents/Activity tabs depend on tables that don't exist yet — mirror mobile's placeholder behavior.
