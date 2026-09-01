# Gupshup WhatsApp Integration Guide for VSYK Chits

**Status**: Backend module implemented & verified
**Scope**: WhatsApp 1-to-1 conversational chatbot + webhook routing + notification framework via Gupshup

---

## 1. Architecture Overview

```
WhatsApp User
     │
     ▼
Gupshup Cloud (Enterprise WhatsApp Business Solution Provider)
     │
     ▼ (HTTP POST to /api/whatsapp/webhook)
VSYK Express Backend (Backend/src/whatsapp/)
     ├── webhook.ts        (Payload validation, idempotency, async dispatch)
     ├── phoneUtils.ts     (Bidirectional E.164 ↔ 10-digit DB normalizer)
     ├── chatbot.ts        (Stateless conversation router, menus, handlers)
     ├── service.ts        (Customer, chit group, dues, payment history queries)
     └── gupshup.ts        (Server-side HTTP client for Gupshup Session & Template APIs)
     │
     ▼
Supabase Database (PostgreSQL) + Razorpay Integration
```

---

## 2. File Organization

All WhatsApp backend logic is cleanly encapsulated inside `Backend/src/whatsapp/` to prevent bloating `server.ts`:

| File | Role |
|------|------|
| [`Backend/src/whatsapp/index.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/index.ts) | Express Router mounting endpoints under `/api/whatsapp/` |
| [`Backend/src/whatsapp/types.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/types.ts) | Gupshup v2 webhook payload and internal interfaces |
| [`Backend/src/whatsapp/phoneUtils.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/phoneUtils.ts) | Phone normalizer (`normalizePhoneToDb`, `normalizePhoneToGupshup`, `isValidIndianMobile`) |
| [`Backend/src/whatsapp/gupshup.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/gupshup.ts) | Outbound communication service with safe logging and timeouts |
| [`Backend/src/whatsapp/webhook.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/webhook.ts) | Inbound webhook handler with deduplication and async execution |
| [`Backend/src/whatsapp/chatbot.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/chatbot.ts) | Business logic for greetings, numbered menu options, fallbacks |
| [`Backend/src/whatsapp/service.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/service.ts) | Live Supabase queries for customer data, chit groups, and dues |
| [`Backend/src/whatsapp/__tests__/whatsapp.test.ts`](file:///Users/kirankishorev/Documents/Projects/AS_VSYK/VSYK_APP/Backend/src/whatsapp/__tests__/whatsapp.test.ts) | Comprehensive automated test suite |

---

## 3. Environment Configuration

### Backend (`Backend/.env`)

```env
# Server
PORT=5000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Razorpay
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# Gupshup WhatsApp Integration
GUPSHUP_API_KEY=your_gupshup_api_key
GUPSHUP_APP_NAME=your_gupshup_app_name        # e.g., VSYKCHITS
GUPSHUP_SOURCE_PHONE=91XXXXXXXXXX             # Registered WABA phone with 91 prefix, no '+'
```

> **Security Rule**: Never commit `.env` files or hardcode API keys in source code or documentation.

---

## 4. Webhook Contract

### Inbound Endpoint
- **URL**: `POST /api/whatsapp/webhook`
- **Headers**: `Content-Type: application/json`

### Handling Lifecycle
1. **Immediate Ack**: The server validates the request structure and responds with HTTP `200 OK` (e.g. `{"status": "received"}`) within milliseconds.
2. **Deduplication / Idempotency**: Inspects `payload.id`. Queries `notification_log` with key `wa_inbound:{id}` to ensure retried webhooks do not trigger duplicate replies.
3. **Customer Lookup**: Normalizes `payload.source` (e.g., `919876543210` → `9876543210`) and queries `customers` table.
4. **Chatbot Processing**: If customer exists, routes to menu/business logic. If unregistered, sends support fallback.
5. **Outbound Dispatch**: Sends session text message back to the customer via Gupshup's Session Messaging API.

---

## 5. Chatbot Conversation Flows

### Menu Navigation
When a registered user sends a greeting (`Hi`, `Hello`, `Namaste`, `Menu`, etc.):

```text
👋 Welcome to VSYK Chits, Kiran!

How can we help you?

1️⃣ My Chit Details
2️⃣ Payment Due
3️⃣ Pay Installment
4️⃣ Payment History
5️⃣ Download Receipt
6️⃣ Contact Support

Reply with a number (1-6)
```

### Options Breakdown
1. **My Chit Details**: Lists all active chit fund groups, ticket numbers, total value, and duration.
2. **Payment Due**: Aggregates all unpaid payment schedules, calculating net due factoring in dividends.
3. **Pay Installment**: Summarizes due amounts and guides member to complete Razorpay payment in the member app.
4. **Payment History**: Fetches the last 10 successful installment transactions with payment dates.
5. **Download Receipt**: Provides guidance on viewing and downloading receipts from the app.
6. **Contact Support**: Displays VSYK office support contact and operating hours.

---

## 6. Testing

Run the automated test suite directly:

```bash
cd Backend
npm run build && node dist/whatsapp/__tests__/whatsapp.test.js
```

### Testing Webhook Manually via cURL

```bash
# 1. Simulate Inbound Greeting
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "app": "VSYKCHITS",
    "timestamp": 1723710000000,
    "version": 2,
    "type": "message",
    "payload": {
      "id": "manual-test-001",
      "source": "919876543210",
      "type": "text",
      "payload": { "text": "Hi" },
      "sender": { "phone": "919876543210", "name": "Kiran" }
    }
  }'

# 2. Simulate Delivery Status Callback
curl -X POST http://localhost:5000/api/whatsapp/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "app": "VSYKCHITS",
    "timestamp": 1723710000000,
    "version": 2,
    "type": "message-event",
    "payload": {
      "id": "wamid.12345",
      "type": "delivered",
      "destination": "919876543210"
    }
  }'
```

---

## 7. Deployment & Live Gupshup Dashboard Configuration

### Requirements for Live Webhook
Gupshup requires a publicly accessible HTTPS URL.

1. **Deploy the backend** to a secure host (e.g. Render, Railway, AWS, or use ngrok for local staging).
2. **Configure in Gupshup Dashboard**:
   - Navigate to: **Gupshup Dashboard** → Your App (e.g., `VSYKCHITS`) → **Webhooks** / **Callback URL**
   - Set Callback URL to: `https://<your-domain>/api/whatsapp/webhook`
   - Enable events: Inbound Messages & Message Delivery Events
   - Save configuration.
3. Test end-to-end by sending a message from your personal WhatsApp to your Gupshup WhatsApp Business number.
