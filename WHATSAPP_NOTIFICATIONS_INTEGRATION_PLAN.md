# WhatsApp Notifications Integration Plan for VSYK Chits

**Goal**: Add reliable, low-friction WhatsApp notifications (primarily proactive reminders) without over-complicating the existing architecture.

**Priorities (MVP-first)**:
- Auction reminders: **exactly 2 days prior** and **2 hours prior** to customers in the relevant chit group.
- Payment reminders (upcoming dues, day-of, simple overdue).
- Support "other important stuff": auction live/winner, prize settlement recorded, payment received confirmation, group status changes.
- Keep existing Firebase push notifications working in parallel (dual delivery for higher reach).
- Make the integration **simple, maintainable, and extensible** later into a light bot (inbound commands like "status", "due", "pay link").

**Guiding principle**: Extend the **existing Backend** (the single place that already does time-based auction scheduling + group member lookup + notifications). Do **not** introduce new heavy frameworks, separate bot servers, or queues yet.

**Date**: 2026-06-12  
**Status**: Proposed plan (ready for review + implementation)

---

## 1. Current State (What We Can Leverage)

- **Backend** (`Backend/src/server.ts`):
  - Runs a `setInterval` every 60 seconds calling `runAuctionScheduler()`.
  - `runAuctionScheduler()` already:
    - Opens upcoming auctions → live.
    - Closes live auctions (picks lowest bid winner).
    - Sends **FCM pushes** to all members of the group via `sendPushToCustomers(customerIds, {title, body, data})`.
    - Has helper: `getGroupMemberCustomerIds(chitGroupId)` (queries `chit_members`).
  - Existing explicit endpoints: `/api/auctions/notify-upcoming`, `/api/auctions/notify-installments`, `/api/auctions/notify-winner`, `/api/auctions/apply-settlement`.
  - Uses `supabaseAdmin` (service role) for privileged reads/writes.
  - Already knows auction `scheduled_at`, `closes_at`, `auction_number`, `chit_group_id`, status.

- **Database (Supabase)**:
  - `customers` table: has `phone`, `full_name`, `id` (the customer_id used everywhere).
  - `chit_members`: links `customer_id` + `chit_group_id` + `ticket_number`.
  - `auctions`: rich timing + settlement fields.
  - `payment_schedules`: `month_number`, `due_date`, `amount`, `paid`, `dividend_amount`, `chit_member_id`.
  - `member_device_tokens`: already stores per-customer push tokens (for FCM).

- **Phones**: Available and used for login (`customers.phone`). Format handling exists (strip `+91`).

- **Notification gaps today**:
  - Only in-app + FCM push.
  - No **pre-auction** reminders (only live/closed).
  - No systematic payment reminders.
  - No WhatsApp channel (many Indian users prefer/prefer WA for reliability).

**Key insight**: 70-80% of the hard parts (group resolution, time checks on auctions, customer lookup) are **already solved** in the Backend scheduler.

---

## 2. Recommended Approach (Keep It Simple)

**Use Meta's official WhatsApp Cloud API** (not Twilio, not unofficial libraries, not self-hosted WABiz/Venom).

**Why this is the simplest**:
- No extra hosting for the WhatsApp connection itself (Meta hosts the number).
- Free tier is generous for notifications volume.
- Template messages are the right model for **proactive reminders** (exactly what we need).
- Webhooks for delivery status (optional at first).
- One small Node module using `axios` (or the lightweight `@whatsapp/whatsapp-cloud-api` if stable) + the existing Express server.
- We already have an Express backend that can expose a small `/api/whatsapp/...` surface if needed.

**Out-of-scope for Phase 1 (to stay not complicated)**:
- Full conversational bot with NLP/state machines.
- Media (PDF statements, images) initially.
- User-initiated "chat" flows (we can add light reply buttons or quick "STATUS" keyword later).
- Multiple phone numbers / multi-tenant.

**Delivery model**:
- **Templates only** for all proactive messages (Meta requirement for non-24h windows).
- Send **both FCM push + WhatsApp** for important events (or let user preference decide later).
- All scheduling lives in the existing Backend interval (or a dedicated `runNotificationJobs()` function called from it).

---

## 3. High-Level Architecture (Text Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Express + setInterval)         │
│  runAuctionScheduler()          +   runPaymentReminders()   │
│         │                                    │               │
│         ▼                                    ▼               │
│  • Detect auctions 2d/2h before           • Query payment_   │
│  • getGroupMemberCustomerIds()             schedules due soon│
│         │                                    │               │
│         ▼                                    ▼               │
│  sendAuctionReminder(2d/2h)         sendPaymentReminder()    │
│         │                                    │               │
│         └────────────────┬───────────────────┘               │
│                          ▼                                    │
│                 sendWhatsAppTemplate(phone, templateName, vars)│
│                          │                                    │
│                 ┌────────┴────────┐                           │
│                 │   Meta Cloud    │                           │
│                 │   WhatsApp API  │  (templates must be pre-  │
│                 └────────┬────────┘   approved in Business Mgr)│
│                          │                                    │
│                 Customer WhatsApp (phone from customers.phone) │
└─────────────────────────────────────────────────────────────┘

Parallel (unchanged):
  sendPushToCustomers(...) → Firebase → App push

Opt-in stored in DB (customers.whatsapp_opt_in or small preferences table)
```

Everything new lives inside `Backend/src/`.

---

## 4. Minimal Schema Changes (Keep Very Small)

**Option A (simplest — recommended for MVP)**: Add columns directly to `customers`:

```sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT,           -- normalized E.164 e.g. 919876543210 (optional override)
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}';
```

**Option B (cleaner later)**: New tiny table `customer_notification_prefs` (one row per customer).

**Recommendation**: Start with **Option A** (2-3 columns). Easy to query, no joins for notifications.

Also consider (nice-to-have, not blocking):
- Simple `notification_logs` table (id, customer_id, channel='whatsapp'|'fcm', type, template, sent_at, meta). Useful for debugging and "already sent today" dedup.

**Migration file**: Add `031_whatsapp_preferences.sql` (or append to a small notifications migration).

---

## 5. Message Templates (The Heart of WhatsApp Notifications)

All proactive messages **must** use approved **Message Templates** in Meta Business Manager.

Suggested initial set (keep names short, clear, versionable):

1. **auction_reminder_2d**
   - Category: Utility / Reminder
   - Body example:
     ```
     Hi {{1}}, 

     Auction #{{2}} for your {{3}} group is scheduled in **2 days** ({{4}} at {{5}}).

     Please be ready to participate. Lowest bid wins the prize pool.

     View details in the VSYK app.
     ```
   - Variables: full_name, auction_number, group_name, date, time

2. **auction_reminder_2h**
   - Similar but "in about 2 hours".
   - More urgent tone.

3. **payment_reminder_due**
   - "Your installment for {{1}} (Month {{2}}) of ₹{{3}} is due on {{4}}. Pay via app or cash collection to stay on track."

4. **payment_received**
   - Confirmation after a successful transaction or cash collection recorded.

5. **auction_won** / **prize_settlement_recorded**
   - "Congratulations! You won Auction #X in {{group}}. Prize of ₹Y will be processed. Settlement recorded on [date]."

6. **auction_live_now**, **group_joined**, **overdue_simple**, etc.

**Process**:
- Create these exact templates in Meta Business Manager (under your WABA / phone number).
- Copy the exact template **name** (e.g. `auction_reminder_2d`) and parameter order into code.
- Meta reviews (usually quick for Utility templates).
- Use the **exact same parameter order** when sending.

Start with 3-4 templates only.

---

## 6. Scheduling & Trigger Logic (Leverage What Exists)

### Auction Pre-Reminders (2 days / 2 hours)

Enhance `runAuctionScheduler()` (or extract a `sendPreAuctionReminders()` called from it):

```ts
// Pseudo inside the existing scheduler loop (or a new function)
const now = new Date();

// 2 days prior
const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
// 2 hours prior
const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000);

// Find upcoming auctions where scheduled_at is within a small window of the target times
// (use small tolerance, e.g. ±30-60 minutes, because scheduler runs every minute)
// Query auctions with status='upcoming' and scheduled_at between (target - tolerance) and (target + tolerance)

// For each such auction:
//   const customerIds = await getGroupMemberCustomerIds(auction.chit_group_id);
//   const optedIn = await filterWhatsAppOptedIn(customerIds);  // new helper
//   for each: await sendWhatsAppAuctionReminder(customerId, '2d' | '2h', auction);
```

**Important**: 
- Track "already sent" (use `notification_logs` or a simple `last_notified_at` on auctions or a small map in memory for the process lifetime).
- Only send if `whatsapp_opt_in = true` (and phone exists).

### Payment Reminders

Add a new lightweight function:

```ts
async function runPaymentReminders() {
  // Query payment_schedules where paid=false, due_date in next X days (or today/overdue)
  // Join to get customer phone + group name via chit_members → chit_groups
  // Filter opted-in
  // Dedup (don't spam same reminder multiple times per day)
  // Call sendWhatsAppTemplate
}
```

Call `runPaymentReminders()` from the same `setInterval` (every 60s is fine — the query can be cheap with proper indexes + `WHERE due_date >= now() - interval '1 day' AND due_date <= now() + interval '4 days'` etc.).

**Suggested cadence (configurable later)**:
- 3 days before due
- 1 day before
- Day of (morning)
- Overdue (gentle)

Use the same excellent cycle due logic from `Frontend/lib/chitPayments.ts` (port the `getCycleDueAmount` awareness if needed, but for reminders we mostly care about `payment_schedules` rows that are unpaid + due soon).

---

## 7. Implementation Steps (Ordered — Start Here)

**Phase 1 — Core Notifications (the main request)**

1. **Meta Business Setup** (one-time, outside code):
   - Create / use Meta Business Manager.
   - Add WhatsApp Business Account + phone number (can be a test number first).
   - Get `WHATSAPP_PHONE_NUMBER_ID` and permanent `WHATSAPP_ACCESS_TOKEN`.
   - Create and **get approved** the 3-4 templates above.
   - Note the Graph API version (e.g. `v20.0`).

2. **Backend changes** (`Backend/src/server.ts` + new small file):
   - Add new env vars: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_API_VERSION`.
   - Create `src/config/whatsapp.ts` or inline a small `sendWhatsAppTemplate(toPhoneE164: string, templateName: string, params: string[])` function using simple `fetch` or axios (add axios to package.json if not present — very light dep).
   - Implement `filterCustomersWithWhatsAppOptIn(customerIds: string[])` helper (query `customers` for opted-in + phone).
   - Enhance / extract notification sending:
     - Keep `sendPushToCustomers` as-is.
     - Add `sendWhatsAppToCustomers(customerIds, templateName, paramBuilder)`.
   - Extend `runAuctionScheduler()` (or add `sendPreAuctionReminders(now)` called inside the loop) for 2d and 2h windows.
   - Add `runPaymentReminders()` and call it from the interval.
   - Add simple dedup (e.g. `notification_logs` insert with unique constraint on customer + type + date, or just check recent logs).
   - Add two new HTTP endpoints for manual triggering (great for testing/admin):
     - `POST /api/notifications/auction-pre-reminder` (body: auctionId, offset: '2d'|'2h')
     - `POST /api/notifications/payment-reminder` (body: customerId or groupId)

3. **Database**:
   - Run migration `031_add_whatsapp_prefs.sql` (add columns to `customers` + optional `notification_logs`).
   - Backfill `whatsapp_opt_in = true` for testing (or leave false until UI).

4. **Admin tools (small)**:
   - In existing admin customer screens (mobile or web): add a toggle / checkbox "WhatsApp notifications".
   - Simple list view or filter "Opted in for WA".

5. **Testing**:
   - Use Meta test phone numbers + your own number (add as recipient in Business Manager).
   - Trigger via the new API endpoints or by manipulating `scheduled_at` in DB.
   - Verify both FCM (if app installed) + WhatsApp arrive.
   - Check template parameter order exactly.

**Phase 2 (after Phase 1 stable)**:
- Add opt-in flow in member profile (mobile + web).
- Better preference page (channel selection: push only / wa only / both).
- Light inbound webhook (`POST /api/whatsapp/webhook`) that can handle simple text replies ("DUE", "STATUS", "STOP") using the 24h customer service window.
- Delivery status logging from webhooks.
- Rate limiting / quiet hours.

---

## 8. Key New Code Outline (Backend)

New / modified functions (all in Backend):

- `sendWhatsAppTemplate(phone: string, template: string, parameters: string[]): Promise<{success: boolean, messageId?: string}>`
- `getOptedInCustomerPhones(customerIds: string[]): Promise<Array<{id: string, phone: string}>>`
- `buildAuctionReminderParams(auction, offset: '2d'|'2h')`
- `sendAuctionPreReminders(now: Date)`
- `sendPaymentReminders(now: Date)`
- Update the main interval to also call the new reminder functions.

Reuse heavily:
- `getGroupMemberCustomerIds`
- `supabaseAdmin`
- Existing auction query patterns

Add a small `src/lib/whatsapp.ts` if you want to keep server.ts clean.

---

## 9. Opt-in & Compliance (Do Not Skip)

WhatsApp is strict:
- You can **only** message users who have explicitly opted in.
- Provide clear value + easy opt-out ("Reply STOP to unsubscribe").
- Store consent timestamp if possible (the `notification_preferences` JSONB can hold `{ whatsapp_opt_in_at: '...' }`).
- In the app: When admin adds a customer or member joins, surface the WA opt-in clearly.
- Never send marketing spam — stick to **transactional + reminder** use cases (these are allowed under Utility category).

For the first rollout: Admin can bulk-set opt-in for existing active members (after they have been informed).

---

## 10. Risks & Mitigations (Kept Simple)

| Risk                        | Mitigation                                      | Complexity |
|-----------------------------|--------------------------------------------------|------------|
| Template approval delay     | Start with 2-3 core templates; use test numbers | Low       |
| Phone format issues         | Normalize to E.164 (91...) on send + store      | Low       |
| Spam / user complaints      | Strong opt-in + easy STOP handling; quiet hours | Medium    |
| Scheduler missing exact time| Run every 60s + tolerance window (±45 min)      | Low       |
| Duplicate messages          | notification_logs + "sent today" checks         | Low       |
| Meta rate limits            | Small batching + exponential backoff            | Low       |

---

## 11. Files to Touch (Summary)

**New**:
- `Backend/src/lib/whatsapp.ts` (or inside server for v1)
- `Backend/migrations/031_add_whatsapp_prefs.sql` (or put in Frontend/supabase/migrations/ to match existing pattern)
- Possibly `Backend/src/config/whatsapp.ts`

**Modify**:
- `Backend/src/server.ts` (main integration point)
- `Backend/package.json` (axios if not using native fetch)
- `Backend/.env` (new secrets — never commit)
- Existing admin customer screens (mobile: `Frontend/app/(admin)/customers/_components/...` + web equivalent) for opt-in toggle.
- Member profile screens (optional for Phase 1).

**Documentation**:
- Update this plan as you implement (mark sections complete).
- Add a short "WhatsApp" section to `PHASE_2_ROADMAP.md` or `FUNCTIONALITY_COMPLETE.md` later.

---x

## 12. Effort Estimate & Rollout

**MVP (Auction 2d/2h + basic payment reminders + dual delivery)**: 3-7 days of focused work (mostly Backend + one migration + minimal admin toggle).

**Breakdown**:
- Meta Business + template creation + approval: 1 day (can run in parallel).
- Backend sending + scheduler extension: 2-3 days.
- Schema + basic admin opt-in UI: 1-2 days.
- Testing + hardening (dedup, errors, logging): 1 day.

**Recommended rollout**:
1. Internal test with 5-10 real customers (admin sets opt-in manually).
2. Enable for one active group.
3. Monitor delivery + user feedback.
4. Then widen.

---

## 13. Future (When Ready — Do Not Build Now)

- Full light bot (inbound webhook responding in 24h window).
- Richer messages (buttons for "Pay Now" deep link, "View Group").
- Statement PDFs via document messages.
- Quiet hours per customer.
- Analytics dashboard of notification open/delivery rates.
- Move scheduler to Supabase pg_cron or a proper job queue (only if volume grows).

---

## Next Actions (for you / team)

1. Review this plan — decide on schema approach (columns vs new table).
2. Set up Meta Business Account + phone number (even a test one).
3. Create the 3 core templates (`auction_reminder_2d`, `auction_reminder_2h`, `payment_reminder_due`) and get names approved.
4. Create the migration and add columns.
5. Start implementation in `Backend/src/server.ts` — begin by adding the WhatsApp send function and the two pre-auction reminder blocks inside the existing scheduler.

This plan is deliberately **narrow and leverages what already exists** (especially the auction scheduler and group member resolution). It delivers exactly the "proper notification before the auction starts (2 days prior and 2 hours prior)" + payment reminders without introducing unnecessary complexity.

When you're ready to start coding or want me to generate the exact migration SQL + the `sendWhatsAppTemplate` function skeleton + the scheduler patch, just say the word.

---

**References to existing code** (for implementers):
- Scheduler entry: `Backend/src/server.ts:84` (`runAuctionScheduler`)
- Group lookup: `Backend/src/server.ts:75` (`getGroupMemberCustomerIds`)
- Push helper: `Backend/src/server.ts:50` (`sendPushToCustomers`)
- Payment schedule logic: `Frontend/lib/chitPayments.ts` (use for inspiration on what "due" means)
- Customer phone usage: login flows in both Frontend and _VSYK_WEB
- Existing notify endpoints: lines ~255-350 in server.ts (good pattern to follow for new manual trigger endpoints)

This should be easy to analyze and execute. Let's discuss any part!