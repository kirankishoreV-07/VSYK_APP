# VSYK_APP --- Claude Code Master Instructions

## 0. Mission

You are the primary coding agent for the `VSYK_APP` repository.

Repository: https://github.com/kirankishoreV-07/VSYK_APP

The immediate objective is to integrate the existing VSYK Chits backend
with WhatsApp through **Gupshup**, without breaking any existing
application functionality.

The long-term WhatsApp system must support:

1.  Customer identification from WhatsApp number
2.  Welcome/menu flow
3.  Chit details
4.  Upcoming installment / amount due
5.  Payment initiation
6.  Payment status
7.  Payment history
8.  Receipt access
9.  Customer support
10. Automated installment reminders
11. Payment-success notifications
12. Secure backend-to-Gupshup communication

The existing repository is a full-stack Expo/React Native +
Express/TypeScript + Supabase + Razorpay application. The backend is
under `Backend/`, and the frontend is under `Frontend/`.

------------------------------------------------------------------------

# 1. CRITICAL OPERATING RULES

## DO NOT blindly modify the project

Before writing code:

-   Inspect the complete repository structure.
-   Read the root `README.md`.
-   Read `Backend/package.json`.
-   Read `Backend/src/server.ts`.
-   Read `Backend/.env.example`.
-   Inspect existing Supabase configuration.
-   Inspect existing payment/Razorpay implementation.
-   Inspect existing customer/chit/payment data access.
-   Inspect all relevant WhatsApp documentation under
    `docs/integrations/`.
-   Search the entire repository for:
    -   `whatsapp`
    -   `gupshup`
    -   `razorpay`
    -   `payment`
    -   `customer`
    -   `chit`
    -   `installment`
    -   `receipt`
    -   `phone`
    -   `mobile`
    -   `scheduler`

Do not assume a file does or does not exist.

Use the existing architecture wherever possible.

## DO NOT rebuild existing functionality

Do not replace:

-   Supabase
-   Razorpay
-   Express
-   TypeScript
-   Expo
-   existing authentication
-   existing database schema
-   existing payment flows

unless there is a genuine technical requirement and the reason is
documented first.

Prefer small, isolated, production-quality additions.

------------------------------------------------------------------------

# 2. CURRENT REPOSITORY ARCHITECTURE

Expected high-level structure:

``` text
VSYK_APP/
├── Frontend/
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── assets/
│   └── supabase/
│       └── migrations/
│
├── Backend/
│   └── src/
│       ├── server.ts
│       └── config/
│
└── docs/
```

The repository currently uses:

-   Expo / React Native
-   TypeScript
-   Express
-   Supabase/PostgreSQL
-   Razorpay
-   Expo notifications / Firebase-related notification infrastructure

Backend default port is currently `5000`.

------------------------------------------------------------------------

# 3. FIRST TASK --- ENVIRONMENT AND DEPENDENCIES

Immediately inspect the project and determine:

-   Node.js version requirements
-   npm version compatibility
-   package manager
-   frontend dependencies
-   backend dependencies
-   available npm scripts

Then install dependencies properly.

Run, as appropriate:

``` bash
cd Frontend
npm install

cd ../Backend
npm install
```

Do not reinstall packages unnecessarily if `node_modules` is already
valid.

After installation:

``` bash
cd Backend
npm run build
```

and run the existing backend development command to verify the project
still starts.

Also verify the frontend dependency installation without changing
frontend code.

If installation/build fails:

1.  Read the error carefully.
2.  Fix the root cause.
3.  Do not randomly upgrade all packages.
4.  Do not change major dependency versions unless necessary.
5.  Explain any dependency change.

------------------------------------------------------------------------

# 4. ENVIRONMENT VARIABLES

There are existing `.env.example` files.

Inspect them first.

Do NOT create fake credentials.

When a required secret/value is missing, ask the developer for it.

The developer will provide the required environment values when
requested.

Expected categories include:

### Existing backend values

-   `PORT`
-   `SUPABASE_URL`
-   `SUPABASE_ANON_KEY`
-   `SUPABASE_SERVICE_ROLE_KEY`
-   Razorpay credentials
-   FCM credentials, if required by existing functionality

### New WhatsApp/Gupshup values

Determine the exact values required by the current Gupshup
API/documentation before deciding the variable names.

Likely categories include:

-   Gupshup app identifier
-   Gupshup API key
-   WhatsApp business phone number
-   webhook verification/configuration value if required
-   Gupshup API base URL, if configurable

Do not invent credential values.

Do not ask the developer to paste secrets into source code.

Do not commit `.env`.

Do not print secret values in logs.

Do not include secrets in GitHub commits.

------------------------------------------------------------------------

# 5. SECURITY --- NON-NEGOTIABLE

The Gupshup API key must remain server-side.

NEVER put it in:

-   React Native code
-   Expo public environment variables
-   frontend JavaScript
-   client bundles
-   GitHub
-   README
-   screenshots
-   logs
-   API responses

The architecture must be:

``` text
WhatsApp
   ↓
Gupshup
   ↓
VSYK Express Backend
   ↓
Supabase / Razorpay
```

NOT:

``` text
WhatsApp
   ↓
Frontend
   ↓
Gupshup
```

------------------------------------------------------------------------

# 6. WHATSAPP BACKEND DESIGN

Create a clean backend WhatsApp integration.

Prefer a structure similar to:

``` text
Backend/src/
├── server.ts
├── config/
├── whatsapp/
│   ├── gupshup.ts
│   ├── webhook.ts
│   ├── service.ts
│   ├── types.ts
│   └── chatbot.ts
```

However, first inspect the existing architecture and follow its
conventions. Do not create unnecessary folders if the project already
has a better established pattern.

Responsibilities should be separated:

### gupshup.ts

Only Gupshup API communication.

Examples:

-   send text message
-   send template message
-   future interactive message support

### webhook.ts

Inbound WhatsApp HTTP endpoint.

Expected endpoint:

``` text
POST /api/whatsapp/webhook
```

The exact route may be changed only if repository conventions require
it.

### chatbot.ts

Conversation/menu/business logic.

### service.ts

VSYK-specific customer/chit/payment operations.

Do not put all logic into `server.ts`.

------------------------------------------------------------------------

# 7. WEBHOOK REQUIREMENTS

The webhook must:

1.  Accept HTTP POST.
2.  Parse Gupshup's inbound payload correctly.
3.  Validate/handle malformed payloads safely.
4.  Extract the customer's WhatsApp phone number.
5.  Extract the incoming message/text when applicable.
6.  Log safe diagnostic information without secrets.
7.  Find the corresponding VSYK customer.
8.  Route the message into chatbot logic.
9.  Return an appropriate HTTP response quickly.
10. Avoid duplicate processing where practical.

Do not assume the Gupshup payload format.

Verify the current Gupshup documentation/API contract before
implementing the parser.

If there are multiple possible inbound event types, design the parser so
unsupported event types are safely ignored or handled.

------------------------------------------------------------------------

# 8. CUSTOMER IDENTIFICATION

The WhatsApp number should be mapped to an existing VSYK customer.

Before implementing:

-   inspect the actual Supabase customer schema
-   identify the exact phone/mobile column
-   inspect how phone numbers are currently stored
-   inspect whether country code is included
-   inspect existing phone normalization utilities

Create one reusable phone-normalization function.

It must handle common variations such as:

``` text
+91XXXXXXXXXX
91XXXXXXXXXX
XXXXXXXXXX
```

but do not make unsafe assumptions.

The final normalization strategy must match the actual database format.

Do not create duplicate customers automatically from an unknown WhatsApp
number unless explicitly instructed.

For an unrecognized number, respond with a safe support/registration
message.

------------------------------------------------------------------------

# 9. INITIAL CHATBOT FLOW

The first working chatbot should be simple and reliable.

When a known customer sends:

``` text
Hi
```

or:

``` text
Hello
```

or similar greeting:

Respond with a VSYK menu.

Target concept:

``` text
👋 Welcome to VSYK Chits

How can we help you?

1. My Chit Details
2. Payment Due
3. Pay Installment
4. Payment History
5. Download Receipt
6. Contact Support
```

Do not hard-code customer financial data.

All financial information must come from Supabase.

------------------------------------------------------------------------

# 10. CUSTOMER DATA FLOW

Before writing SQL/queries, inspect the existing schema and current
application queries.

Determine the correct relationship:

``` text
Customer
   ↓
Chit membership
   ↓
Chit group
   ↓
Installment/payment schedule
   ↓
Payment
```

Use the existing database relationships.

Do not duplicate data into a new WhatsApp-specific database.

Do not create new tables unless there is a demonstrated requirement.

------------------------------------------------------------------------

# 11. CHATBOT FEATURES

Implement incrementally.

## Feature 1 --- Greeting/menu

Working first.

## Feature 2 --- My Chit Details

Return relevant existing chit information from Supabase.

## Feature 3 --- Payment Due

Return:

-   chit/group
-   installment
-   due date
-   amount due
-   current payment status

## Feature 4 --- Payment initiation

Reuse the existing Razorpay backend/payment architecture where
technically appropriate.

Do not create a second payment system.

The target flow is:

``` text
WhatsApp
   ↓
Pay Installment
   ↓
VSYK Backend
   ↓
Existing Razorpay order/payment mechanism
   ↓
Customer completes payment
   ↓
Razorpay callback/webhook
   ↓
Existing VSYK payment verification
   ↓
Payment marked correctly
```

Do not mark a payment PAID merely because a WhatsApp user clicked a
button.

Only verified payment events can update payment status.

## Feature 5 --- Payment history

Use existing VSYK payment data.

## Feature 6 --- Receipt

Reuse existing receipt generation/access logic if present.

Do not create duplicate receipt logic unless necessary.

## Feature 7 --- Support

Return the configured VSYK support/contact mechanism.

Ask the developer for the exact support number/message if it is not
already in the repository.

------------------------------------------------------------------------

# 12. WHATSAPP TEMPLATES

The eventual templates should include:

### installment_reminder

Concept:

``` text
Hello {{customer_name}},

Your VSYK Chits installment of ₹{{amount}}
is due on {{due_date}}.

Please make the payment before the due date.

Thank you,
VSYK Chits Pvt Ltd
```

### payment_success

Concept:

``` text
Hello {{customer_name}},

Your payment of ₹{{amount}} has been successfully received.

Payment ID: {{payment_id}}

Thank you,
VSYK Chits Pvt Ltd
```

### payment_overdue

Concept:

``` text
Dear {{customer_name}},

Your VSYK Chits installment of ₹{{amount}}
was due on {{due_date}}.

Please make the payment at the earliest.
```

These are content concepts only.

Do not submit templates automatically without developer approval.

Do not assume template names/categories/language settings until the
current Gupshup/WhatsApp requirements are verified.

------------------------------------------------------------------------

# 13. OUTBOUND GUPSHUP MESSAGING

Create a server-side Gupshup service.

It should expose clean functions such as:

``` ts
sendTextMessage(...)
sendTemplateMessage(...)
```

Do not spread raw Gupshup HTTP calls throughout the application.

Use:

``` text
Chatbot / Reminder Service
        ↓
Gupshup Service
        ↓
Gupshup API
```

The service must:

-   use environment variables
-   use timeouts
-   handle HTTP errors
-   avoid leaking API keys
-   return structured errors
-   log safe request metadata only

------------------------------------------------------------------------

# 14. WEBHOOK IDEMPOTENCY

WhatsApp/Gupshup events may be retried.

Inspect the inbound payload for an event/message ID.

If an ID exists, design for idempotent processing.

Do not respond twice to the same inbound message because of a retry.

Do not create a new database table solely for this until you have
inspected whether an existing logging/event mechanism can be reused.

If a new persistence mechanism is genuinely necessary, explain it before
implementing.

------------------------------------------------------------------------

# 15. ERROR HANDLING

The chatbot must fail gracefully.

Examples:

### Unknown customer

``` text
We could not find your VSYK account using this WhatsApp number.

Please contact VSYK support for assistance.
```

### Temporary database failure

Do not expose internal errors.

Return a customer-friendly message.

### Gupshup API failure

Log the technical error server-side without secrets and return a
controlled response.

### Invalid webhook payload

Return an appropriate HTTP error or safe acknowledgement according to
the Gupshup webhook contract.

------------------------------------------------------------------------

# 16. DEVELOPMENT TESTING

Before asking the developer to configure Gupshup:

### Test the backend locally

Verify:

``` text
GET /api/health
```

Then test:

``` text
POST /api/whatsapp/webhook
```

using a representative test payload based on the current Gupshup
documentation.

Do not invent a fake production payload and claim it is valid.

Create automated tests for:

-   greeting
-   phone normalization
-   known customer
-   unknown customer
-   invalid payload
-   chatbot menu routing
-   duplicate event handling if implemented
-   Gupshup error handling

------------------------------------------------------------------------

# 17. PUBLIC WEBHOOK

The Gupshup webhook cannot point to:

``` text
localhost
127.0.0.1
192.168.x.x
```

It needs a public HTTPS URL.

First determine how the VSYK backend is deployed.

Possible deployment platforms include:

-   Render
-   Railway
-   AWS
-   another HTTPS backend host

Do not choose a platform without checking the current project/deployment
setup.

For temporary development testing, a secure HTTPS tunnel may be used if
appropriate, but production must use a stable deployment URL.

The eventual endpoint should look conceptually like:

``` text
https://<backend-domain>/api/whatsapp/webhook
```

Do not invent the domain.

------------------------------------------------------------------------

# 18. GUPSHUP DASHBOARD

DO NOT ask the developer to configure the Gupshup webhook until:

1.  Backend route exists.
2.  Backend builds.
3.  Backend starts.
4.  Endpoint is publicly accessible.
5.  Endpoint has been tested.
6.  Required Gupshup credentials are configured server-side.
7.  The exact callback URL is confirmed.

Only then guide the developer to:

``` text
Gupshup
→ VSYKCHITS
→ Webhooks
→ Add Webhook
```

The developer already has a Live Gupshup app.

Do not create another Gupshup app.

Do not create another WABA.

Do not create another WhatsApp number.

Do not create another API key unless the existing credential is
demonstrably unusable.

------------------------------------------------------------------------

# 19. DO NOT BREAK EXISTING PAYMENT FUNCTIONALITY

This is extremely important.

The repository already contains Razorpay functionality.

Before touching payment code:

-   inspect the current order creation
-   inspect payment verification
-   inspect payment database updates
-   inspect existing webhook/callback handling
-   inspect authentication requirements

WhatsApp should call/reuse existing backend payment services rather than
duplicating payment logic.

------------------------------------------------------------------------

# 20. GIT SAFETY

Before making significant changes:

``` bash
git status
```

Create a clear checkpoint if appropriate.

After changes:

``` bash
git status
git diff
```

Never commit:

``` text
.env
.env.*
API keys
tokens
private keys
service account JSON
credentials
```

unless the file is explicitly an example file containing placeholders.

Use `.gitignore` correctly.

------------------------------------------------------------------------

# 21. DOCUMENTATION

Create/update documentation for the integration.

Recommended:

``` text
docs/integrations/whatsapp/
```

Document:

-   architecture
-   environment variables
-   local setup
-   webhook endpoint
-   Gupshup configuration
-   chatbot flow
-   customer lookup
-   payment flow
-   testing
-   deployment
-   troubleshooting

Do not put secrets in documentation.

------------------------------------------------------------------------

# 22. CHANGE MANAGEMENT

For every meaningful change, tell the developer:

1.  What you inspected.
2.  What you changed.
3.  Why you changed it.
4.  Which files changed.
5.  Which dependencies were added.
6.  Which environment variables are required.
7.  Which commands were run.
8.  Whether build/tests passed.
9.  What the developer needs to provide next.

Do not hide failures.

Do not say "done" if the feature has not actually been tested.

------------------------------------------------------------------------

# 23. HOW TO HANDLE MISSING INFORMATION

When something is required from the developer:

STOP at the correct boundary and ask for exactly what is needed.

Examples:

``` text
I need the Gupshup API key.
Please add it to Backend/.env locally.
Do not paste it into chat.
```

or:

``` text
I need to know where the backend is deployed.
Please tell me whether it is Render, Railway, AWS, local-only, or another platform.
```

Do not ask for credentials that are not actually required.

Do not request secrets in chat when they can be entered directly into
`.env`.

------------------------------------------------------------------------

# 24. REQUIRED EXECUTION ORDER

Follow this order.

### Phase 1 --- Inspect

-   repository
-   package files
-   backend
-   frontend
-   database schema
-   payment flow
-   existing WhatsApp docs

### Phase 2 --- Install

-   frontend dependencies
-   backend dependencies
-   verify Node/npm
-   build backend

### Phase 3 --- Design

Write a short implementation plan based on the actual repository.

### Phase 4 --- Environment

Identify required variables.

Ask developer for missing values.

### Phase 5 --- Backend foundation

Implement:

``` text
/api/whatsapp/webhook
```

plus clean Gupshup service abstraction.

### Phase 6 --- Local testing

Test webhook + chatbot logic.

### Phase 7 --- Customer integration

Connect phone number → customer → Supabase data.

### Phase 8 --- Payment integration

Reuse existing Razorpay logic.

### Phase 9 --- Outbound messages/templates

Add the required Gupshup sending functions.

### Phase 10 --- Deployment

Deploy backend publicly over HTTPS.

### Phase 11 --- Gupshup webhook

Configure:

``` text
https://<real-domain>/api/whatsapp/webhook
```

### Phase 12 --- End-to-end testing

Test from the actual WhatsApp number.

------------------------------------------------------------------------

# 25. DEFINITION OF DONE

Do not consider the integration complete until:

-   [ ] Frontend dependencies installed
-   [ ] Backend dependencies installed
-   [ ] Backend builds successfully
-   [ ] Existing backend health endpoint works
-   [ ] WhatsApp webhook route exists
-   [ ] Webhook accepts the correct Gupshup payload
-   [ ] Customer phone lookup works
-   [ ] Unknown customers are handled safely
-   [ ] Greeting/menu works
-   [ ] Chit information comes from real Supabase data
-   [ ] Due amount comes from real data
-   [ ] Payment flow uses existing Razorpay architecture
-   [ ] Payment status is verified server-side
-   [ ] Receipt functionality uses existing VSYK logic where available
-   [ ] Gupshup outbound messaging works
-   [ ] Error handling works
-   [ ] Secrets are server-side only
-   [ ] No secrets are committed
-   [ ] Tests/build pass
-   [ ] Public HTTPS webhook works
-   [ ] Gupshup webhook is configured
-   [ ] Real WhatsApp end-to-end test succeeds
-   [ ] Documentation is updated

------------------------------------------------------------------------

# 26. IMPORTANT: START NOW

Start by doing ONLY the following:

1.  Inspect the repository thoroughly.
2.  Inspect both `Frontend/package.json` and `Backend/package.json`.
3.  Inspect `Backend/src/server.ts`.
4.  Inspect `.env.example` files.
5.  Inspect existing WhatsApp documentation.
6.  Inspect existing Supabase/customer/chit/payment queries.
7.  Inspect existing Razorpay implementation.
8.  Install missing dependencies.
9.  Run the backend build.
10. Report the findings.

DO NOT immediately start rewriting the application.

DO NOT create the Gupshup webhook dashboard configuration yet.

DO NOT ask for every credential at once.

First determine exactly what is missing.

Then ask for only the next required environment value/configuration.

The goal is a clean, incremental, production-ready integration into the
existing VSYK_APP --- not a separate demo application.
