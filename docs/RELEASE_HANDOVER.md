# VSYK Chits — Release Handover

**Date:** 4 September 2026
**App:** `com.vsykchits.app` · v1.0.0 (versionCode 1)
**Stack:** Expo SDK 54 · React Native 0.81.5 · Express + TypeScript on Node 22 · Supabase

| | |
|---|---|
| Section 1 functional testing | **Passed** |
| Backend deployment | **Live** |
| Android APK | **In build queue** |
| iOS | **Deferred** (no Apple Developer account) |
| Tests passing at peak | **118** |
| Defects fixed | **9** |
| Open blockers | **5** |
| Store submission | **Blocked** |

---

## 1. Functional verification

Run against a local Supabase stack with synthetic data and dry-run integrations. No production data touched; no real payments, auctions, refunds or WhatsApp messages triggered.

| Suite | Result | Coverage |
|---|---|---|
| Release lifecycle | **45 / 45** | Group creation → 5 customers enrolled → unique sequential tickets → instalments and dues → sandbox payment + receipt → activation → live auction → cross-session bids → invalid/simultaneous/late bids rejected → winner declared → discount, commission, dividend, payout verified for all five → duplicate payment, finalization and payout all rejected → per-customer data isolation |
| Playwright e2e | **32 / 32** | Admin route protection, deterministic Back on 11 parent routes, placeholders and validation, create + duplicate rejection + persistence across reload, dashboard figures matched against Supabase, zero console/API errors, no horizontal overflow at 3 viewports, two-member live bidding with one authoritative settlement |
| Backend suites | **41 / 41** | Payments 13, webhook security 3, WhatsApp 21, stale-claim sweep 4 |

> ⚠️ **These suites no longer exist.** During workspace cleanup all backend `__tests__` directories, the Playwright specs and `playwright.config.ts` were deleted at your instruction. None of the fixes below currently has a regression test. Recoverable from git history in the original repo, e.g.
> `git show HEAD:Backend/src/payments/__tests__/releaseLifecycle.test.ts`

---

## 2. Defects found and fixed

Ordered by financial consequence.

### 2.1 Retracted bids kept driving settlement — CRITICAL

**Symptom.** A member placed ₹22,000 and ₹21,000, then retracted both. The admin console showed *0 BIDS / "Awaiting first bid"* while simultaneously displaying *HIGHEST DISCOUNT ₹22,000* and *Winner Gets ₹11,78,000*. The member app still demanded a bid above ₹22,000.

**Root cause.** The recalculation trigger from migration 032 runs as the **invoker**. The member performs the retract, so its `UPDATE public.auctions` is evaluated against `auctions_update_admin_only` — RLS filters the row out and the update affects **0 rows with no error raised**. The insert-side twin `update_current_highest_bid` *is* `SECURITY DEFINER`, which is why placing a bid updated the figure but retracting never did.

**Why it mattered.** `current_bid` is the input to settlement. Pressing "Declare Winner" would have computed the discount, the winner's prize and every member's dividend from a bid nobody held — real money moved on a retracted offer.

**Verified.** Reproduced as a real member session (`authenticated` role with the member's JWT claims):

| Scenario | Before | After |
|---|---|---|
| Bid ₹22,000, retract it | `2200000` ❌ | `0` ✅ |
| Two bids, retract only the top | — | falls back to `2100000` ✅ |
| Retract the last one | — | `0` ✅ |
| Re-apply the migration | — | idempotent ✅ |

Lifecycle suite still 45/45 afterwards.

**Fix:** `+ Frontend/supabase/migrations/044_fix_retract_recalc_privileges.sql`

### 2.2 Production schema three migrations behind the app — CRITICAL

**Symptom.** `23514 — new row for relation "chit_groups" violates check constraint "chit_groups_status_check"` on group creation.

**Root cause.** The new explicit-activation flow inserts `status: 'draft'`, legal only after migration 043 widens the constraint from `('active','completed','cancelled')`. Migrations 041–043 existed only on the local database.

| Migration | Adds | Breaks without it |
|---|---|---|
| 041 | `collection_followups`, `staff_members` | Collections / follow-ups screens |
| 042 | `apply_verified_payment`, `record_admin_installment_payment`, `record_prize_payout`, `apply_auction_settlement` | Recording payments, prize payouts, settlement |
| 043 | `draft` status, `auctions.commission_amount`, guarded settlement wrapper, race-safe tickets/bids | Group creation, auctions, winner declaration |

**Also fixed.** 041 and 043 were not idempotent, so a partially-applied run could never be retried (`42P07: relation "staff_members" already exists`). Both now re-apply from any state — proven by re-running all three against an already-migrated database.

**Fix:** `~ 041_collections_followups.sql` · `~ 043_release_lifecycle_integrity.sql`

### 2.3 A failed read turned into an unauthorised write — CRITICAL

**Symptom.** `42501 — new row violates row-level security policy for table "auctions"`, while trying to pre-generate 20 auctions for a 12-month group.

**Root cause.** `fetchAuctions` destructured only `data`, silently discarding `error`. On a cold start the Supabase session restores asynchronously, so the first read goes out unauthenticated, `is_admin()` is false, and the list returns empty. `ensureAuctionsExist` then concluded every auction was missing and tried to insert them. RLS was working correctly — the app was asking the wrong question.

**Fix.** The read now checks `error` and bails rather than publishing an empty list; a new ref records whether the list came from a verified read; generation additionally awaits `getSession()`; a genuine insert failure raises a visible alert. Had the insert succeeded it would have created duplicate auction rows.

`~ Frontend/app/(admin)/groups/[id]/index.tsx`

### 2.4 Live auction screen showed a different auction — HIGH

**Symptom.** Group roadmap showed "Auction #1 · LIVE NOW"; opening it showed "UPCOMING, not LIVE" with a blank auction number.

**Root cause.** `router.push('/(admin)/auctions/live')` carried no id, so the screen ran a **database-wide** search for any live auction and fell back to any configured upcoming one. The blank "Auction #" proved it had loaded an auto-generated placeholder — the local database holds 100 such rows across groups.

**Fix.** The screen accepts an `auctionId` route param and loads exactly that auction whatever its status; all four entry points now pass it.

`~ auctions/live.tsx` · `~ auctions/index.tsx` · `~ groups/[id]/index.tsx`

### 2.5 Group activation was impossible and silent — HIGH

**Root cause.** Activation requires the group to be completely full, and the ACTIVATE GROUP button was `disabled` whenever it wasn't — so the alert explaining the shortfall was unreachable. With the default capacity of 50 and a handful of members there was no path forward and no message saying why.

**Fix.** The button is pressable while the group is a draft, the message names the shortfall, and the auction guard states the real reason.

`~ Frontend/app/(admin)/groups/[id]/index.tsx`

### 2.6 Rate limiting counted every user as one client — HIGH

**Root cause.** `trust proxy` was never set. Behind Railway's proxy `req.ip` resolves to the proxy, so the entire user base shared a single 300-request / 15-minute bucket and would have started receiving 429s almost immediately.

**Verified.** Two requests with different `X-Forwarded-For` clients now each report `RateLimit-Remaining: 299` — independent buckets.

`~ Backend/src/server.ts` — `TRUST_PROXY_HOPS`, default 1

### 2.7 Server crash-looped on the host's Node version — HIGH

**Root cause.** `Error: Node.js 20 detected without native WebSocket support`. supabase-js builds a RealtimeClient eagerly inside `createClient()` and needs a native `WebSocket` global, which arrived in Node 22. An earlier `engines` range of `">=20 <27"` let Railway pick the floor.

**Fix.** Raised to `">=22 <27"` plus `.nvmrc`. Build log confirms `node 22.23.2 (idiomatic-version-file)`.

`~ Backend/package.json` · `+ Backend/.nvmrc`

### 2.8 Production build could not compile — MEDIUM

With `NODE_ENV=production`, a plain `npm ci` omits devDependencies and the TypeScript build fails with `TS7016: Could not find a declaration file for module 'express'`. Reproduced locally — hence the mandatory `--include=dev` in the build command. Also removed an unused `expo` dependency from the backend, pinned `main` to `dist/server.js`, and stopped tests compiling into the shipped `dist`.

`~ Backend/package.json` · `~ Backend/tsconfig.json`

### 2.9 Invalid route declaration — LOW

`groups/[id]` has its own nested `Stack`, so declaring the grandchild `groups/[id]/members` in the admin Tabs layout was invalid and warned on every render. Navigation always worked; the declaration was removed.

`~ Frontend/app/(admin)/_layout.tsx`

---

## 3. Backend deployment

Express + TypeScript on Railway. Verified live, not assumed.

| Check | Result | Meaning |
|---|---|---|
| `GET /api/health` | **200** | Serving over HTTP/2 TLS |
| `POST /api/auth/admin/login` | **401** | Not 500 — Supabase env resolves and is reachable |
| RateLimit headers | **300 / 299** | Per-client bucket through the proxy |
| `POST /api/whatsapp/webhook` | **200** | Rejection logged, payload not processed — by design, so Gupshup does not retry-storm |

```
URL             https://vsykbackend-production.up.railway.app
Root Directory  Backend
Build Command   npm ci --include=dev && npm run build
Start Command   npm run start
Node            22.23.2  (from .nvmrc)
Port            8080     (injected by Railway — never set PORT yourself)
```

19 required variables are set: Supabase URL / anon / service-role, `ADMIN_LOGIN_USERNAME`, `OTP_PEPPER`, `ADMIN_API_SECRET`, Razorpay key and secret, six Gupshup values, four approved template ids, and `ENABLE_SCHEDULER=false`. `GUPSHUP_DRY_RUN` is deliberately unset so real WhatsApp sends work.

- **Razorpay is in TEST mode** (`rzp_test_…`). The app holds no Razorpay key at all — the backend returns `keyId` per order, so payment mode is a backend decision, not a build-profile setting.
- **The scheduler is off.** Turning it on immediately sends real WhatsApp to every member with a due or overdue instalment. Not reversible once sent.
- **FCM is not configured on the server** — no `FCM_SERVICE_ACCOUNT_BASE64`, so backend push sends no-op.

---

## 4. Repository

Clean deployment repo with fresh history: <https://github.com/kirankishoreV-07/VSYK_APP-DEP> — public, 230 files, 44 migrations.

| Commit | Change |
|---|---|
| `5ca8305` | Backend — Express, Supabase, Razorpay, Gupshup, collections, rate limiting |
| `d2ae84c` | Mobile app — member and admin Expo Router app, 44 migrations |
| `4a2d2fd` | Trust proxy, drop unused expo dependency, pin Node, document FCM base64 |
| `40ecf31` | Require Node 22+ so the server starts on a managed host |
| `d94be27` | Point EAS builds at the deployed Railway backend |

Verified on the remote: zero `.env`, `google-services.json`, `node_modules` or `.DS_Store` paths published.

### 🔴 Credentials are exposed in two places — rotate them

1. **The original repository's history.** `Backend/.env` was committed in `bfdef97` and `86fe354` and later removed. Deletion does not remove a file from history — `git show <commit>:Backend/.env` still returns it to anyone who can clone. This is why the new repo was started from a clean root rather than by pushing the existing 26 commits into a public repo.
2. **The chat transcript.** The full `.env` was pasted in, including the Supabase **service-role key** (bypasses every RLS policy), the Gupshup API key, Razorpay secret, `OTP_PEPPER`, `ADMIN_API_SECRET` and `GUPSHUP_WEBHOOK_TOKEN`.

Rotate all of them. Changing `OTP_PEPPER` invalidates every pending OTP.

---

## 5. Android build

Preview APK profile, `com.vsykchits.app`, versionCode 1, signed with EAS credentials `Ma0CnlVX4m` — **the same keystore must be reused for every future update**.

| Item | State |
|---|---|
| Permissions | **INTERNET only.** `READ_EXTERNAL_STORAGE` and `WRITE_EXTERNAL_STORAGE` were Expo defaults and are now explicitly blocked — receipt and CSV export use app-scoped storage, which needs no permission |
| Target SDK | API 36 via Expo SDK 54, above Play's API 35 floor |
| Firebase | Uploaded to EAS as secret file variable `GOOGLE_SERVICES_JSON`; `app.json` references `$GOOGLE_SERVICES_JSON`. Keeps the file out of git while still reaching the builder — the first build failed precisely because EAS only uploads git-tracked files |
| Icons | 🔴 **Blocker** — icon, splash and adaptive icon are all still Expo's placeholder grey-circles template |

The second build is queued. Free-tier builds wait behind paid ones — the first took roughly an hour to reach a builder — but they do run.

---

## 6. What is still blocking release

### 1. Apply migrations 041 → 044 to production Supabase

Until these land, creating a group still fails and the retracted-bid figure stays wrong on the live auction. Run each file's full contents in the SQL editor, in order.

> ⚠️ **Never run 042 alone after 043.** 042 contains `CREATE OR REPLACE FUNCTION apply_auction_settlement` with the raw implementation; run after 043 it silently overwrites the guarded wrapper and duplicate-finalization protection is lost — an auction could be settled twice, paying a member out twice. If you ever re-run 042, always follow it with 043.

### 2. Rotate every exposed secret

Supabase service-role key, Gupshup API key, Razorpay secret, `OTP_PEPPER`, `ADMIN_API_SECRET`, `GUPSHUP_WEBHOOK_TOKEN`. Update Railway, then redeploy.

### 3. Configure the Gupshup webhook

Inbound WhatsApp — chatbot menu, delivery receipts — does nothing until this points at the deployed backend.

```
URL     https://vsykbackend-production.up.railway.app/api/whatsapp/webhook
Header  x-webhook-token: <GUPSHUP_WEBHOOK_TOKEN>
```

The header is mandatory; without it the server logs a rejection and ignores the payload.

### 4. Replace the placeholder artwork

Apple Guideline 4.0 / 2.3.8 and Google's branding requirements both reject template assets. `adaptive-icon.png` also needs to be its own file — it is currently byte-identical to the splash graphic, and Android masks adaptive icons to a circle with only the centre ~66% guaranteed visible.

### 5. Restore regression coverage before the production build

Nine fixes currently ship untested. The lifecycle and e2e suites are recoverable from git history.

### Also outstanding, lower priority

- **iOS untouched** — deferred pending the Apple Developer account. Xcode 26.2 is installed but has no simulator runtime; native iOS testing never ran.
- **Native Android testing never ran** — no SDK, emulator or device was available on this machine.
- **Sections 3 and 4 not started** — the Strix security scan and the full store-readiness audit.
- **Group capacity is not editable after creation** — the edit form never loads it back, so a group created at the default 50 can only be fixed by recreating it.
- **Field inconsistency** — one group reported `no_of_installments = 20` against a 12-month duration, and different screens read different fields. Which is authoritative is a product decision.
- **100 placeholder auction rows** exist across groups from client-side pre-generation — the design smell that made the wrong-auction bug both possible and silent.
- **Open product question** — should a chit group require 100% enrolment before its first auction? That is the rule as implemented; it means a group with one unsold ticket can never start.

---

*Every result above was observed from a command or a live endpoint. Nothing is reported as verified that was not run.*
