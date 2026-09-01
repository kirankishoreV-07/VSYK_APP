# VSYK_APP Codebase Memory

Last inspected: 2026-09-01

This is the working architecture map for future changes. It describes the current workspace, including the uncommitted authentication, WhatsApp, payment-hardening, RLS, privacy, and account-deletion work. Source and migrations take precedence over older README/docs claims.

Latest auth fix: frontend auth persistence now uses the versioned `vsyk-auth-session-v2` storage namespace. Pre-auth-rework Supabase storage entries are removed during session restore, an invalid/missing session clears the companion `vsyk_member_id`, and Supabase `SIGNED_OUT` events clear member state. There is no longer a customer-ID-only restore path that bypasses a real authenticated session.

Latest development-network fix: the temporary `trycloudflare.com` API hostname configured in `Frontend/.env` expired and stopped resolving, which caused member OTP requests to fail before reaching Express. Local development now points to the verified LAN listener on port 5000. `Frontend/lib/api.ts` centralizes POST transport, adds a 15-second timeout, safely parses non-JSON failures, and reports a diagnostic development target instead of the opaque React Native `Network request failed` message. Because the LAN address is environment-specific, re-check it whenever the development machine changes networks.

## System shape

- `Frontend/`: Expo SDK 54 / React Native 0.81 / Expo Router 6 application containing both member and admin experiences.
- `Backend/`: Express 5 / TypeScript service for privileged operations and integrations.
- Supabase: primary database, Auth, RLS, and Realtime transport. The mobile app reads and performs allowed writes directly through the anon-key client.
- Backend-only responsibilities: WhatsApp OTP/session creation, Gupshup chatbot and templates, Razorpay order creation/verification, FCM pushes, auction scheduling/auto-close, privileged settlement helpers, and account deletion processing.
- Money is stored as integer paise throughout the schema and APIs. Most UI inputs/display convert to rupees.

## Runtime and providers

- `Frontend/app/_layout.tsx`: loads Space Grotesk, Inter, and Hind Madurai; installs React Query, member session context, gesture root, push-notification routing, and the root Expo Router stack.
- `Frontend/app/index.tsx`: animated splash that always routes to onboarding after three seconds.
- `Frontend/app/(auth)/onboarding.tsx`: three-slide static onboarding, then routes to login.
- `Frontend/app/(auth)/login.tsx`: member WhatsApp OTP flow and admin email/password Supabase Auth flow.
- `Frontend/lib/supabase.ts`: persistent AsyncStorage-backed Supabase Auth session and Realtime reconnect settings.
- `Frontend/lib/MemberSessionContext.tsx`: restores a Supabase member session from `user_metadata.customer_id`, keeps a legacy stored customer-id fallback, loads the `customers` profile, registers a device token, and subscribes to profile changes.
- `Frontend/lib/api.ts`: unauthenticated, admin-authenticated, and member-authenticated POST helpers.

## Identity and authorization

- Members are business records in `customers`; memberships use `chit_members.customer_id`.
- WhatsApp OTP verification creates or updates a synthetic Supabase Auth user, stores `customers.auth_user_id`, puts `customer_id` in user metadata, and returns a real access/refresh-token session.
- Admins are real Supabase Auth users with a marker row in `admin_users` keyed by `auth.users.id`.
- Migration 037 defines `is_admin()`, `current_customer_id()`, and `is_own_chit_member()`.
- Migration 038 replaces demo-open RLS on live tables with member/admin policies. Service-role backend clients bypass RLS.
- `Frontend/app/(admin)/_layout.tsx` guards every admin route by requiring both a Supabase session and the caller's own `admin_users` row.
- `Backend/src/middleware/adminAuth.ts` accepts a valid admin JWT; a static `x-admin-secret` remains as a fallback for non-interactive callers.

## Member application

- `Frontend/app/(tabs)/_layout.tsx`: visible tabs are Home, Chits, Auctions, Wallet, and Profile; detail/profile routes are hidden tabs.
- `Frontend/app/(tabs)/index.tsx`: dashboard using active memberships, next unpaid schedules, portfolio/dividend stats, and upcoming configured auctions.
- `Frontend/app/(tabs)/chits.tsx`: active chit cards and navigation to membership detail.
- `Frontend/app/(tabs)/chit/[id].tsx`: authoritative member/group detail, virtual or inserted payment schedules, per-cycle auction settlement, partial-payment totals, unaccounted cash rows, winner/prize status, Realtime refresh, and native Razorpay checkout through backend order/verify endpoints.
- `Frontend/app/(tabs)/auctions.tsx`: lists live auctions for the member's groups, joins an auction, places increasing highest-discount bids, retracts the latest bid within two minutes, and follows bids/auction changes through Realtime plus polling.
- `Frontend/app/(tabs)/wallet.tsx`: group-level payment-history summaries and links to history details.
- `Frontend/app/(tabs)/history/[id].tsx`: payment timeline, status charts, winner highlights, CSV export, and group summary.
- `Frontend/app/(tabs)/join.tsx`: lists active groups not already joined and inserts a full-share membership. The “AI match” score is deterministic UI logic, not an AI service.
- `Frontend/app/(tabs)/profile.tsx`: customer profile editing, i18n switch, logout, privacy-policy navigation, and reviewed account-deletion request.
- `Frontend/app/(tabs)/profile/nominees.tsx`: read-only nominee list UI; add/edit controls are placeholders.
- `Frontend/app/(tabs)/profile/foreclosure.tsx`: presentation-only request flow; it does not write a foreclosure request.
- `Frontend/app/(tabs)/profile/insights.tsx`: static “AI insights” presentation.
- `Frontend/app/(tabs)/profile/privacy-policy.tsx`: static privacy policy.
- `Frontend/app/(tabs)/two.tsx`, `Frontend/app/modal.tsx`, `components/EditScreenInfo.tsx`, `StyledText.tsx`, `Themed.tsx`, and client/color-scheme helpers are Expo-template/legacy utilities with little or no live business role.

## Admin application

- `Frontend/app/(admin)/dashboard.tsx`: AUM, customers, collections, active/scheduled auctions, dividends, six-month collection donut, and recent combined online/cash activity with Realtime refresh.
- `Frontend/app/(admin)/customers.tsx`: customer CRM list/search/filter and customer creation.
- `Frontend/app/(admin)/customers/[id].tsx`: customer hub backed by `useCustomerDetailData`; composes overview, groups, payment history, auctions, and diagnostics.
- Customer child routes under `customers/[id]/`: lightweight wrappers for the corresponding tab components.
- `OverviewTab.tsx`: profile, outstanding dues, recent activity, group snapshots, and navigation shortcuts.
- `GroupsTab.tsx`: group summary, auction history, ledger, cash collection, settlement, and prize payout views.
- `PaymentHistoryTab.tsx`: filters, roadmap, transaction rows, partial/full/overdue derivation, and exports.
- `AuctionsTab.tsx`: customer auction participation/win/prize presentation.
- `DiagnosticsTab.tsx`: detects missing/duplicate/mismatched schedules and payment anomalies.
- `RecordCashCollectionModal.tsx`: accounted separately for unaccounted groups; validates auction-cycle settlement and exact denomination totals, then inserts/updates one `cash_collections` row per member/month.
- `AuctionSettlementModal.tsx`: resolves the highest active bid/winner, computes 5% foreman commission, dividend per share, final due, and winner prize; completes the auction and propagates amounts to schedules.
- `RecordPrizeSettlementModal.tsx`: supports partial prize payouts, exact cash denominations for unaccounted groups, and inserts `auction_prize_settlements`.
- `PrizeSettlementDetailsModal.tsx`: payout history/denomination details.
- `Frontend/app/(admin)/groups/index.tsx`: group directory and multi-field group creation, including accounted/unaccounted mode.
- `Frontend/app/(admin)/groups/[id]/index.tsx`: central group control screen. Loads members/auctions/prize payouts, creates placeholder auctions for every cycle, sanitizes placeholder dates, adds full/half-share members, ensures schedules, configures/launches auctions, opens settlement and prize workflows, and subscribes to group Realtime changes.
- `Frontend/app/(admin)/groups/[id]/members.tsx`: focused member list/detail entry.
- `GroupMemberPaymentModal.tsx`: member transaction history, installment recording, and member removal.
- `Frontend/app/(admin)/auctions/index.tsx`: upcoming/live/history tabs with aggregate bid/member data.
- `Frontend/app/(admin)/auctions/live.tsx`: live auction control center with filtered Realtime subscriptions and 10-second convergence polling; highest active discount wins; declare/stop paths complete the auction and propagate schedule dues.
- `Frontend/app/(admin)/reports.tsx`: group/customer collection analytics and six-month chart. Some metrics are approximate (group progress uses `group.value * 10`).
- `Frontend/app/(admin)/settings.tsx`: reports navigation and admin logout only.

## Shared business logic

- `Frontend/lib/auctionUtils.ts`: defines the 1970 placeholder schedule sentinel, distinguishes real configured auctions from placeholders/stale rows, deduplicates rows by group/cycle, and sanitizes bad placeholder dates.
- `Frontend/lib/chitPayments.ts`: one auction per cycle, collectibility only after settlement (cycle 1 has a base-installment exception), payment status/remaining logic, robust settlement propagation to schedules, and base schedule creation.
- `Frontend/lib/auctionWinner.ts`: winner matching/highlight/name helpers.
- `Frontend/lib/memberGroupHistory.ts`: unified accounted/unaccounted member timeline, virtual schedules, transaction-to-cycle mapping, summary calculations, due calculation, and CSV data.
- `Frontend/lib/dashboardAnalytics.ts`: collection aggregation, donut geometry, activity normalization, and relative-time formatting.
- `Frontend/lib/hooks/useDashboard.ts`: active chits, dashboard stats, upcoming configured auctions, and money/date formatters.
- `Frontend/lib/hooks/admin/useCustomerDetailData.ts`: current customer-hub query, KPI calculation, and Realtime invalidation.
- `Frontend/lib/hooks/useAdminCustomerDetail.ts`: older alternate customer timeline hook; appears unused by the current hub.
- `Frontend/lib/notifications.ts`: foreground notification behavior, native FCM-token registration, token upsert, and deep-link mapping.
- `Frontend/lib/csvExport.ts`: CSV escaping, cache-file creation, and share sheet.
- `Frontend/lib/i18n.ts` and locale JSON: English, Tamil, and Hindi resources, currently limited mainly to nav/profile strings.
- `Frontend/lib/constants.ts` and admin style utilities: color, spacing, typography, radius, elevation, and badge tokens.

## Auction lifecycle

1. Group detail pre-generates one `upcoming` auction row per cycle using `scheduled_at/closes_at = 1970-01-01`, `min_bid/max_bid = 0`.
2. Admin configuration sets real times and bid limits; immediate launch sets `live`, otherwise the backend scheduler opens it at `scheduled_at`.
3. Members join and insert bids. Database triggers validate eligibility/range/monotonic highest bid and maintain `auctions.current_bid`; retractions are time-limited and trigger recalculation.
4. Highest non-retracted discount bid wins.
5. Settlement economics: 5% foreman commission; distributable discount is `discount - commission`; per-share dividend reduces the base installment; winner prize is `group value - discount`.
6. Completing/closing writes settlement fields and calls `applyAuctionSettlementToSchedules` so every member's cycle schedule is updated/created.
7. Prize disbursement is independent and can be recorded in multiple partial `auction_prize_settlements` rows.

## Payments

- Accounted/online: client requests an authenticated backend Razorpay order for its own schedule. Backend derives/clamps remaining amount, persists `payment_orders`, verifies HMAC and captured Razorpay payment, then updates `payment_schedules.paid_amount/paid` and inserts an installment transaction idempotently.
- Unaccounted/cash: admin records one cumulative `cash_collections` row per membership/cycle with denomination breakdown. Member/history logic treats cash as its own source of truth.
- A cycle normally becomes collectible only when its corresponding auction is completed and the settlement amount is known.
- Payment helper tests cover full, partial, remainder, duplicate/no-op, and overpayment arithmetic.

## Backend modules and routes

- `Backend/src/server.ts`: Express setup, CORS allowlist, global/OTP rate limits, router mounting, FCM initialization, push dedupe, 60-second auction/payment/WhatsApp scheduler, and admin auction routes.
- `GET /api/health`: health check.
- `POST /api/auth/otp/request`, `/verify`: WhatsApp OTP issue/verification and member Supabase session creation.
- `POST /api/payments/razorpay/order`, `/verify`: server-authoritative payment flow.
- `POST /api/account/delete-request`: authenticated member deletion request.
- `POST /api/account/process-deletion`: admin-only PII anonymization and Auth-user removal while preserving financial rows.
- `POST /api/auctions/scheduler/run`: admin-triggered scheduler execution.
- `POST /api/auctions/notify-winner`, `notify-installments`, `notify-upcoming`: FCM pushes.
- `POST /api/auctions/apply-settlement`: privileged bulk schedule update.
- `POST /api/whatsapp/webhook`: token/app-checked Gupshup inbound and delivery events.
- `GET /api/whatsapp/status/:messageId`: admin-only process-local delivery status lookup.

## WhatsApp/Gupshup

- `whatsapp/gupshup.ts`: session text, templates, media, opt-in API, safe timeout/error handling, dry-run choke point, and an ephemeral 5,000-entry delivery-status map.
- `whatsapp/webhook.ts`: acknowledges immediately, parses text/button/list replies, claims inbound message IDs in `notification_log`, authorizes senders, invokes chatbot, and records delivery events.
- `whatsapp/chatbot.ts`: stateless menu. Live functions: customer authorization, chit details, and outstanding dues. Payment history/receipt direct users to the app; support is static.
- `whatsapp/service.ts`: phone/customer authorization, opt-in/out, active-membership gate, chit lookup, finalized outstanding balances, and payment history.
- `whatsapp/proactiveNotifications.ts`: consent/activity-gated, deduplicated/retry-safe installment-due, overdue, auction-scheduled, and partial-payment templates; stale claim recovery and capped concurrency.
- `whatsapp/templates.ts`: approved-template parameter ordering; no template ID means safe failure/no send.
- `whatsapp/phoneUtils.ts`, `types.ts`: Indian phone normalization/validation and integration types.
- WhatsApp tests include offline units plus environment-dependent live/security/RLS scripts. Do not run live scripts casually.

## Database progression

- 001-008: legacy profiles, groups/members/schedules, auctions/bids/reminders, wallet, nominees/foreclosure, legacy admin auth, and customers.
- 009-016: extended group metadata, auction events/fields, admin/member policies, participation shares, member transactions, optional legacy `user_id`, and unique group/customer membership.
- 017-027: temporary demo-open policies, settlement fields, participants/customer identity, database bid validation, highest-bid semantics, retraction fields/policy.
- 028-033: unaccounted cash, capacity trigger, prize settlements, Realtime publication, bid recalculation, and notification log.
- 034-039: WhatsApp consent, OTP/Auth linkage, payment order hardening, real admin Auth, RLS lockdown, and account-deletion timestamps.

Primary tables: `customers`, `admin_users`, `chit_groups`, `chit_members`, `payment_schedules`, `payment_orders`, `chit_member_transactions`, `cash_collections`, `auctions`, `auction_bids`, `auction_participants`, `auction_prize_settlements`, `member_device_tokens`, `notification_log`, `whatsapp_otp_requests`. Legacy/partial tables include `profiles`, `nominees`, `foreclosure_requests`, `wallet_transactions`, `auction_reminders`, and `auction_events`.

## Current validation and known issues

- Backend `npm run build`: passes.
- `applyPayment` offline tests: 10 passed, 0 failed.
- Frontend `tsc --noEmit`: currently fails with 8 errors:
  - missing `filterBtnText` and `filterBtnTextActive` styles in `customers.tsx`;
  - `prizeSettlements` passed to `OverviewTab` but absent from its props;
  - four customer child routes use `customer.name` instead of `customer.full_name`;
  - `getDevicePushTokenAsync` is called with an unsupported argument for the installed Expo Notifications types.
- `RecordPrizeSettlementModal` writes `payment_type: 'prize'`, but migration 014's check constraint and frontend `PaymentType` do not allow `prize`; the settlement row may succeed while the transaction insert fails (and is treated as non-fatal).
- `nominees.user_id` references `profiles.id`, while its RLS policy compares it directly to `auth.uid()`; those UUIDs are normally different. Migration 038 calls nominees “already correct,” but the identity condition appears broken. The UI also reads `nominee_name`, whereas the schema column is `full_name`.
- Foreclosure UI never inserts into `foreclosure_requests`; migration 038 removes all table policies, so there is no member submission path.
- `useUpcomingAuctions` always returns `has_reminder: false` and does not query `auction_reminders`; reminder state is incomplete.
- A Razorpay test key is hardcoded as a client fallback in the chit detail screen. The backend-returned key is used in the normal order flow, so the fallback should be removed or moved to configuration.
- `Backend/src/whatsapp/__tests__/createAdminUser.ts` contains a fallback admin credential and prints it. Remove the fallback and never log passwords before committing or sharing.
- Payment verification performs several separate database writes without a transaction/RPC. Order idempotency helps retries, but concurrent verification or a mid-flow failure can still leave schedule, transaction, and order state partially updated.
- Auction settlement logic exists in several places (admin live screen, settlement modal, backend scheduler), increasing drift risk. The scheduler uses participation shares for schedule propagation, while the live screen computes dividends using group `capacity`; half-share economics need a single authoritative formula.
- Account deletion anonymizes common fields but leaves `age`, `gender`, `gstin_number`, and potentially other identifying columns intact; confirm the intended anonymization policy.
- Gupshup delivery status is process-local and disappears on restart; persistence is explicitly not implemented.
- `apiPost` sends no auth and is correct only for public endpoints; keep all privileged/member-owned routes on `apiPostAdmin`/`apiPostAuthed`.
- Root README is stale: it lists 33 migrations and a much smaller backend, while the workspace currently has 39 migrations and multiple backend modules.

## Change-safety rules for future work

- Preserve paise/rupee boundaries explicitly.
- Treat `customer_id`, not legacy `user_id`, as member business identity.
- Keep admin financial writes behind real admin Auth/RLS or service-role backend endpoints.
- Keep payment state backend-authoritative; never simulate a successful payment in Expo Go.
- Highest active discount wins; always exclude retracted bids.
- Never treat zero-limit 1970 rows as scheduled auctions.
- A settlement change must update auction fields, per-member schedule amounts, dashboards/history, notifications, and partial/full balances consistently.
- Accounted and unaccounted collection paths must remain separate but converge in reporting.
- Realtime is a freshness mechanism, not a source of truth; refetch authoritative rows after events.
- Do not run the live Gupshup scripts without an explicit dry-run/test destination decision.

## Source-file catalogue

This appendix accounts for source files whose role may be too small to warrant a dedicated section above.

### Frontend route and component files

- `app/+html.tsx`: Expo web HTML shell and responsive background CSS.
- `app/+not-found.tsx`: unmatched-route fallback.
- `app/modal.tsx`: default Expo modal example; not part of the main business flow.
- `app/(auth)/_layout.tsx`: login/onboarding stack registration.
- `app/(admin)/groups/[id]/_layout.tsx`: group detail stack wrapper.
- `app/(admin)/_components/CollectionPieChart.tsx`: interactive SVG collection donut and selected-month/overview panels.
- `app/(admin)/customers/_components/ActivityTab.tsx`: placeholder activity tab.
- `CustomerHeader.tsx`: customer identity/KYC/risk header.
- `KPIStrip.tsx`: active chits, lifetime paid, dividends, outstanding, and on-time KPI cards.
- `OuterTabs.tsx`: customer-hub top tab selector.
- `PaymentsTab.tsx`: compact membership/transaction payment grouping; the fuller flow is `PaymentHistoryTab`.
- `adminStyles.ts`: shared admin customer colors, card styles, badges, and elevation.
- `types.ts`: admin customer domain/UI TypeScript interfaces.
- `utils.ts`: paise/date/status/risk formatting and CSV helpers.
- `app/(admin)/customers/[id]/activity.tsx`, `auctions.tsx`, `diagnostics.tsx`, `groups.tsx`, `payments.tsx`: route wrappers around customer tab components.
- `app/(admin)/customers/_components/AuctionsTab.tsx`, `DiagnosticsTab.tsx`, `GroupsTab.tsx`, `OverviewTab.tsx`, `PaymentHistoryTab.tsx`: the substantive customer-hub tabs described above.
- `app/(admin)/customers/_components/PrizeSettlementDetailsModal.tsx`, `RecordPrizeSettlementModal.tsx`, `RecordCashCollectionModal.tsx`, `AuctionSettlementModal.tsx`: financial detail/write sheets described above.
- `app/(tabs)/chit/MemberPrizePayoutDetailsModal.tsx`: member-safe prize payout history/denomination detail sheet.
- `components/AppLogo.tsx`: reusable VSYK logo image.
- `components/ExternalLink.tsx`: opens links in an in-app browser on native.
- `components/__tests__/StyledText-test.js`: Expo-template snapshot test.
- `components/useClientOnlyValue(.web).ts`, `useColorScheme(.web).ts`, `StyledText.tsx`, `Themed.tsx`: Expo-template platform/theme utilities.

### Frontend support/config files

- `package.json`/`package-lock.json`: npm project; Expo start/android/iOS/web scripts; no lint, test, or typecheck script currently defined.
- `app.json`: package/bundle IDs, Expo Router/font/date-picker plugins, typed routes, and EAS project ID.
- `eas.json`: EAS build profiles.
- `tsconfig.json`: Expo TypeScript base and path alias configuration.
- `tailwind.config.js`, `global.css`, `nativewind-env.d.ts`: NativeWind setup; most screens also use React Native `StyleSheet` directly.
- `.env.example`: public Supabase URL/anon key, backend base URL, and legacy public admin-secret fallback.
- `assets/` and `assets/images/`: app icons, splash, logos, MD photo, favicon, and Space Mono font. Most typography uses downloaded Expo Google fonts.
- `scratch/count_tags.js`: one-off HTML/tag counting utility, not runtime code.
- `supabase/migrations/_VSYK.code-workspace`: editor workspace metadata, not a migration.

### Backend files

- `src/config/supabase.ts`: legacy exported anon-key Supabase client; current privileged modules generally construct their own service-role clients.
- `src/whatsapp/index.ts`: WhatsApp router assembly and admin-protected status route.
- `src/whatsapp/types.ts`: webhook, outbound result, customer, membership, due, history, and delivery-status shapes.
- `src/whatsapp/phoneUtils.ts`: strips prefixes/non-digits, normalizes Indian numbers to DB/E.164 forms, and validates 10-digit mobile prefixes.
- `src/payments/__tests__/payments.test.ts`: offline arithmetic harness (not connected to `npm test`).
- `src/whatsapp/__tests__/whatsapp.test.ts`: broad unit/integration harness for phone, chatbot, Gupshup, service, and webhook behavior.
- `src/whatsapp/__tests__/phase2.security.test.ts`: OTP/enumeration/consent/idempotency security checks against configured Supabase.
- `src/whatsapp/__tests__/phase4.notifications.test.ts`: proactive-template consent, dedupe, balance, and partial-payment checks.
- `src/whatsapp/__tests__/phase5.staleClaims.test.ts`: stale notification-claim recovery.
- `src/whatsapp/__tests__/phase6.rls.test.ts`: member/admin/anon RLS regression checks.
- `src/whatsapp/__tests__/liveGupshup.ts`, `livePhase4Final.ts`: real-provider send/delivery scripts; potentially external-state-changing.
- `src/whatsapp/__tests__/createAdminUser.ts`: admin seed helper; currently unsafe because of its fallback/logged password.
- `package.json`/`package-lock.json`: npm/CommonJS project; dev via nodemon, build via `tsc`, start from `dist`; `npm test` is still the default failing placeholder.
- `tsconfig.json`: strict CommonJS ES2022 build from `src` to `dist`.
- `.env.example`: Supabase, OTP pepper, Razorpay, FCM, Gupshup/app/template/webhook, admin fallback secret, dry-run, and browser-origin keys.
