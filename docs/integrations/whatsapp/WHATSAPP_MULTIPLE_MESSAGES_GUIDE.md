# WhatsApp Official API – Sending Multiple Messages (Clear Guidance for VSYK)

**Date**: 2026-06-12  
**Context**: Direct Meta WhatsApp Cloud API (the recommended official/reliable path). Question: "Shall we send multiple messages? Is that possible in official?"

---

## Short Direct Answer

**Yes — sending multiple messages is fully possible and officially supported** in the Meta WhatsApp Cloud API.

However, it must follow strict rules. You cannot just blast arbitrary messages. Everything proactive is template-based.

For your specific use cases (2 days prior + 2 hours prior auction reminders + payment reminders), **it is not only possible — it is a very good pattern** when done with proper spacing.

---

## Official Rules (2026) – How Multiple Messages Work

### 1. Two Different Modes

| Mode                        | When you can use it                          | What you can send                  | Limits on number of messages |
|-----------------------------|----------------------------------------------|------------------------------------|------------------------------|
| **Business-initiated** (proactive reminders) | Outside any customer service window | **Only approved Message Templates** | Account tier limits (conversations per day) + quality rules |
| **Customer service window** (24-hour) | After the user replies to you (or initiates) | Free-form text + media + buttons + lists (no template needed) | **No hard limit** on number of messages |

- A new user reply **resets and extends** the 24h window.
- Inside the open window you can send as many follow-up messages as needed (very useful for "status", "how to pay", interactive flows later).

### 2. Multiple Proactive Reminders (Templates)

You **can** send multiple different templates to the same user over time.

Examples that work well for VSYK:

- Auction #7 for "Monthly Chit Group A"
  - Day -2: `auction_reminder_2d` template
  - Hour -2: `auction_reminder_2h` template   ← This is two separate business-initiated conversations, ~46 hours apart → **Perfectly allowed**

- Payment due for Month 5
  - 3 days before due: `payment_due_3d` 
  - Day of due: `payment_due_today`
  - (Optional gentle) 1 day overdue: `payment_overdue`

These count as separate conversations for Meta's pricing and limits.

### 3. Important Limits & Protections (Don't Ignore)

- **Account messaging tier**: New numbers start at 250 business-initiated conversations/day. Scales up (1K → 10K → 100K) based on quality. For VSYK this is never a bottleneck.
- **Per-user limits**: Meta has protections against spamming the same person with too many marketing/utility templates in a short period.
- **Quality rating**: High block rate or "STOP" replies lowers your tier and can pause templates. This is the real risk.
- **Pricing (conversation-based)**: Each 24-hour conversation is charged once (regardless of how many messages you send *inside* an open window after a reply). Proactive template messages each start their own conversation billing.

---

## Recommendation for VSYK – What You Should Actually Do

### Good & Recommended (Multiple Messages)

| Event                        | Messages per user          | Spacing          | Notes |
|-----------------------------|----------------------------|------------------|-------|
| One Auction                 | 2 messages (2d + 2h)      | ~46 hours apart | Excellent. Users appreciate advance notice. |
| Payment cycle (one month)   | 1–2 messages               | 3 days before + day-of (or 1 day before) | Do **not** send 4 reminders for the same installment. |
| Auction won + Prize settlement | 1 or 2 messages         | Same day or next day | High value — users love this. |
| After user replies ("STATUS", "PAY", "HELP") | Unlimited in 24h window | As needed | Here you can send rich follow-ups, buttons, etc. |

**Auction 2 days prior + 2 hours prior is ideal** — it is spaced properly and not spammy.

### What to Avoid (Even Though Technically Possible)

- Sending 3+ proactive messages about the **same auction** in < 24 hours.
- Auction reminder + payment reminder + "group update" all on the same day for the same person.
- Any pattern that feels like spam (users will block or report).

**Rule of thumb**: 1–2 proactive template messages per user per day max is safe for a financial product like VSYK. More only if the user has replied and is in an active 24h window.

---

## How This Affects Your Implementation (Official Direct Meta)

In the code (whether you start with Twilio sandbox for testing or go straight to direct Meta Cloud API):

1. **Each reminder type = its own template**
   - `auction_reminder_2d`
   - `auction_reminder_2h`
   - `payment_due`
   - `payment_received`
   - `auction_won_prize_recorded`
   - etc.

2. **Your scheduler decides when to send**
   - In `Backend/src/server.ts` (inside the 60s loop or dedicated reminder jobs):
     ```ts
     // 2 days prior
     await sendAuctionPreReminder(auctionId, '2d');

     // 2 hours prior (separate run, different day or hours later)
     await sendAuctionPreReminder(auctionId, '2h');
     ```

3. **Inside an open 24h window** (if user replies "DUE" or taps a button):
   - You can send multiple free-form or interactive messages in one go.
   - This is where you can later add "Pay now" deep link buttons, "View in app", etc.

4. **Always respect opt-in**
   - Only send to `customers.whatsapp_opt_in = true`.
   - Implement STOP handling (webhook) and set opt-in to false.

---

## Practical Advice for Your Chit Fund Users (India)

- Chit members are used to getting multiple reminders from traditional chits (SMS, calls, WhatsApp groups).
- 2 reminders for an auction is **normal and appreciated**, especially 2 days (planning) + 2 hours (final reminder).
- Combine with the existing FCM push: many users will get both channels. That's fine and increases reliability.

**Suggested safe cadence for VSYK (first version)**:

- Auctions: 2d prior + 2h prior (two templates)
- Payments: One reminder 2–3 days before due + one on the due day (using accurate post-settlement amount)
- High-value events (won, prize credited, payment received): One message each

This is multiple messages — and it is the **correct, official, professional** way.

---

## Next Steps / Code Impact

If you want, I can now give you:

- Exact list of recommended templates with sample bodies (for Meta approval).
- The scheduler logic that safely sends 2d + 2h without over-sending.
- How to handle the case where a user replies and you want to send follow-ups inside the 24h window.

Would you like me to generate the updated `whatsappService.ts` + the reminder functions that implement "multiple messages" the right way?

Or any specific concern (e.g., "what if auction 2d and a payment due happen on the same day for the same member?")?

This is fully supported in the official API when done responsibly. The 2-day + 2-hour pattern you want is actually one of the best uses of multiple proactive messages.