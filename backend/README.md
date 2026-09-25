# Vendly API

A standalone Node.js backend: Express + TypeScript + PostgreSQL + JWT auth + a pluggable payment
provider (a safe local **mock** by default, or **Razorpay** for real payments). No Supabase, no
Firebase, no other BaaS — this is a service you run and control yourself.

```
Mobile app (Expo)  --HTTPS-->  Vendly API (this folder)  --SQL-->  PostgreSQL
                                       |
                                       +--webhook-->  Razorpay (or the built-in mock provider)
```

---

## 1. Local setup (about 20 minutes the first time)

You need **Node.js 20+** and **Docker** (for a local Postgres — or point `DATABASE_URL` at any
Postgres 14+ you already have, local or hosted, and skip Docker).

```bash
cd backend
npm install
cp .env.example .env
docker compose up -d          # starts local PostgreSQL on port 5432
npm run migrate                # creates every table (see migrations/001_init.sql)
npm run seed                   # demo shopkeeper + shop + products + a demo customer
npm run dev                    # starts the API on http://localhost:4000
```

The seed script prints demo login credentials, e.g.:
```
Shopkeeper: owner@vendly.test    (shop: Ritika General Store, subscription already active)
Customer:   customer@vendly.test
Password (both): Password123!
```
`npm run seed` marks the demo shop's subscription **active** directly, purely so you can test
products/billing immediately without clicking through checkout every time. That direct-activation
path exists **only** in this script — every other code path in the app requires a real, signature-
verified webhook (see §6).

Check it's alive: `curl http://localhost:4000/health` → `{"ok":true,...}`.

### Connecting the mobile app
In `../mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL` to an address your **phone** can reach — not
`localhost` (that means the phone itself). Find your computer's LAN IP and use e.g.
`http://192.168.1.42:4000`. Full steps are in `../mobile/README.md`.

---

## 2. Environment variables

All in `.env` (copy from `.env.example`). Never commit `.env` — `.gitignore` already excludes it.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` | Signs access tokens. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | Session lifetime (15 min / 30 days by default) |
| `PAYMENT_PROVIDER` | `mock` (safe default, no real money) or `razorpay` |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` / `RAZORPAY_WEBHOOK_SECRET` / `RAZORPAY_PLAN_ID` | Only needed when `PAYMENT_PROVIDER=razorpay` |
| `PLAN_AMOUNT_PAISE` | The subscription price in paise (100000 = ₹1,000) |
| `SUBSCRIPTION_GRACE_DAYS` | Extra days of access after a renewal is due, to absorb late webhooks/retries |
| `TRIAL_DAYS` | Free trial length for a new shop (0 = none, matching the brief's "payment required to unlock") |
| `PUBLIC_BASE_URL` | This API's own public address (used to build the mock checkout page's URL) |

No secret (JWT key, database password, Razorpay key **secret**) is ever sent to the mobile app —
the app only ever holds `EXPO_PUBLIC_API_BASE_URL`, a plain address.

---

## 3. Database

`migrations/001_init.sql` creates every table with foreign keys and indexes; `002_seed_categories.sql`
adds the default product categories. `npm run migrate` applies whatever hasn't run yet (tracked in a
`schema_migrations` table) — safe to run repeatedly, including as part of deploys.

**Tables:** `users`, `sessions`, `refresh_tokens`, `images`, `shops`, `shop_members`, `categories`,
`products`, `inventory`, `product_price_history`, `inventory_movements`, `shop_customers`,
`shopping_lists`, `shopping_list_items`, `bills`, `bill_items`, `customer_payments`,
`customer_payment_allocations`, `khata_transactions`, `subscriptions`, `payments`, `payment_events`,
`notifications`.

**Money integrity, enforced by the database itself (not just application code):**
- Every money column is `NUMERIC(12,2)`, every quantity `NUMERIC(12,3)` — never floating point.
- `bills`, `bill_items`, `customer_payments`, `khata_transactions` and `inventory_movements` cannot be
  `UPDATE`d or `DELETE`d (database triggers reject it outright). A correction is a new adjustment row,
  never an edit to history.
- `bills` has CHECK constraints tying `total_amount = subtotal - discount` and
  `amount_due = total_amount - amount_paid`, and a trigger blocking any change to a bill's core figures
  after it's saved.
- A product's price is **copied onto the bill** at billing time (`bill_items.unit_price`); changing a
  product's price later never touches an old bill (`product_price_history` keeps the old value too).

**Tenancy:** every shop-owned row carries `shop_id`. There is no Row Level Security here (that's a
Postgres/Supabase-specific feature) — instead, every request is scoped by the API layer itself:
`shop_members` is checked before any shop-scoped write, and every repository query filters by the
shop id taken from the authenticated request, never from a client-supplied value alone.

---

## 4. Authentication

Email + password, not Google or any other OAuth provider:

- Passwords are hashed with **argon2id** (memory-hard, GPU/ASIC-resistant).
- A login issues a short-lived **access token** (JWT, 15 min) and a long-lived **refresh token**
  (random 384-bit string, 30 days). Only the **hash** of a refresh token is stored — a stolen database
  backup cannot be used to log in.
- Refresh tokens **rotate** on every use: presenting a refresh token a second time (after it's already
  been exchanged) revokes that entire session — a signal of possible theft.
- Five wrong passwords in a row locks the account for 15 minutes.
- Every request re-checks that the session hasn't been revoked (logout is effective immediately, not
  just when the 15-minute access token happens to expire).
- Role (`customer` or `shopkeeper`) is set once at registration and is **never** accepted from the
  client again — every protected route re-derives it from the signed token, and `requireRole`
  middleware enforces it server-side. A customer sending `POST /api/v1/shops/:id/products` gets a
  403, no matter what the mobile UI does or doesn't show.

---

## 5. Customer vs. shopkeeper flow

```
Customer:                                  Shopkeeper:
Register/Login (role=customer)             Register/Login (role=shopkeeper)
  → browse shops, free forever               → shop setup (name, address, phone, ...)
                                              → subscription screen (₹1,000/month)
                                              → payment, verified server-side
                                              → shop management unlocked
```

A shopkeeper account with no active subscription can still **create their shop** (`POST /shops`,
`PATCH /shops/:id`) and **view** their subscription status/checkout link — but every management
endpoint (products, stock, billing, customers, khata, dashboard) is behind `requireActiveSubscription`
middleware and returns `402 SUBSCRIPTION_REQUIRED` until the subscription is active. See
`src/middleware/subscription.ts` — it is the single place that decides this, reading `access_until`
from the database.

---

## 6. Subscriptions & payments — how "never trust the app" is enforced

```
App: "Subscribe" → POST /shops/:id/subscription/checkout
  → backend creates a Razorpay subscription, returns its hosted checkout URL
App opens that URL in a browser (no card/UPI details ever touch this backend or its database)
Customer completes the mandate/payment on Razorpay's own page
Razorpay → POST /api/v1/webhooks/razorpay  (signed with RAZORPAY_WEBHOOK_SECRET)
  → signature verified over the RAW request body
  → subscription state updated (subscriptions.access_until, .status)
App polls GET /shops/:id/subscription (or the person pulls to refresh) and sees access unlocked
```

- `subscriptionService.applyWebhookEvent` is the **only** function in the codebase allowed to move a
  subscription toward `active`. It is called from exactly one place: the webhook controller, after
  signature verification.
- Webhook delivery is made idempotent by `payment_events` (`unique(provider, event_id)`) — a retried
  delivery is recognised and skipped, never double-applied.
- Duplicate/out-of-order renewal events can never move access **backwards**: an `ACTIVATED`/`CHARGED`
  event is only applied if its period end is later than what's already stored (see
  `subscriptions/stateMachine.ts`, unit-tested in `tests/unit/stateMachine.test.ts`).
- A failed renewal charge (`subscription.pending` / `.halted`) moves status to `past_due` but does
  **not** cut access early — `access_until` already carries a `SUBSCRIPTION_GRACE_DAYS`-day buffer past
  the paid period, so a slow retry or a late webhook doesn't lock someone out of their own shop.
- Cancelling (`POST /shops/:id/subscription/cancel`) tells Razorpay to stop renewing; the shop keeps
  access until the period it already paid for ends (confirmed by the `subscription.cancelled` webhook,
  never assumed immediately).
- A shop whose subscription lapses is **never deleted**. `expired` only blocks the management
  endpoints; every bill, khata entry and product row stays exactly as it was (see the hourly sweep in
  `jobs/expireSubscriptions.ts`).
- No card, UPI ID, or bank detail is ever stored here — Razorpay's hosted checkout page collects that,
  and only an opaque `provider_payment_id` and the amount/status come back to this database.

### Testing payments safely — the mock provider (default)
With `PAYMENT_PROVIDER=mock` (the `.env.example` default), tapping "Subscribe" in the app opens a
**local page this same server renders** (`GET /mock-checkout`) with "Simulate successful payment" /
"Simulate failed payment" buttons. Both buttons sign and POST a Razorpay-**shaped** webhook body to
`/api/v1/webhooks/mock`, running through the exact same verification → state-machine code path real
traffic uses — so testing here genuinely exercises the production logic, just without Razorpay or
real money involved.

For terminal-based testing of renewals, failures and cancellations without opening a browser:
```bash
npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.charged
npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.pending
npm run webhook:simulate -- --sub mock_sub_xxx --event subscription.cancelled
```
(Find `--sub` in the `subscriptions.provider_subscription_id` column, or from the checkout URL the
app opened.)

### Switching to real Razorpay
1. Create a Razorpay account (start in **Test mode** — test API keys, no real money).
2. `.env`: set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` from
   Dashboard → Settings → API Keys.
3. `npm run razorpay:create-plan` — creates the "Vendly Shopkeeper Pro" plan once and prints its id;
   paste it into `.env` as `RAZORPAY_PLAN_ID`.
4. Dashboard → Settings → Webhooks → add `https://<your-api-host>/api/v1/webhooks/razorpay`, select at
   least: `subscription.authenticated`, `subscription.activated`, `subscription.charged`,
   `subscription.pending`, `subscription.halted`, `subscription.cancelled`, `subscription.completed`.
   Copy its signing secret into `.env` as `RAZORPAY_WEBHOOK_SECRET`.
5. Webhooks need a public HTTPS URL — for local testing, tunnel port 4000 with your preferred tool
   (e.g. ngrok) and use that tunnel's address in step 4; in production this is your deployed API's
   own address (see §8).
6. Test with Razorpay's published test card/UPI/netbanking credentials (search "Razorpay test mode
   payment methods" in their docs for the current list) before ever switching to live keys.

---

## 7. API endpoints

All under `/api/v1`. 🔒 = requires `Authorization: Bearer <access token>`. 🏪 = shopkeeper role +
shop membership. 💳 = additionally requires an active subscription.

```
POST   /auth/register              /auth/login              /auth/refresh
POST   /auth/logout 🔒              /auth/logout-all-others 🔒
GET    /auth/me 🔒                  PATCH /auth/me 🔒          DELETE /auth/me 🔒
POST   /auth/change-password 🔒

GET    /shops 🔒                    (browse/search active shops)
POST   /shops 🔒 (shopkeeper)       GET /shops/mine 🔒 (shopkeeper)
GET    /shops/:id 🔒                PATCH /shops/:id 🏪
GET    /shops/:id/dashboard 💳      GET /shops/:id/sales-summary 💳
GET    /shops/:id/subscription 🏪   POST /shops/:id/subscription/checkout 🏪
POST   /shops/:id/subscription/cancel 🏪

GET    /categories 🔒               GET /products/search?q= 🔒
GET    /shops/:id/products 🔒       POST /shops/:id/products 💳
GET    /shops/:id/products/:pid 🔒  PATCH /shops/:id/products/:pid 💳
POST   /shops/:id/products/:pid/stock 💳

GET    /shops/:id/lists/draft 🔒 (customer)   PUT /shops/:id/lists/draft/items 🔒 (customer)
GET    /lists/mine 🔒 (customer)               GET /lists/:id 🔒
PATCH  /lists/:id/notes 🔒 (customer)          DELETE /lists/:id 🔒 (customer)
POST   /lists/:id/submit 🔒 (customer)
GET    /shops/:id/lists/incoming 💳            POST /shops/:id/lists/:id/view 💳

GET    /shops/:id/customers 💳                 GET /shops/:id/customers/search 💳
POST   /shops/:id/customers 💳                 POST /shops/:id/bills 💳
POST   /shops/:id/customers/:id/payments 💳    POST /shops/:id/customers/:id/adjustments 💳
GET    /bills/:id 🔒                           GET /shop-customers/:id/ledger 🔒
GET    /khata/mine 🔒 (customer)

GET    /notifications 🔒            GET /notifications/unread-count 🔒
POST   /notifications/mark-all-read 🔒
POST   /images 🔒                    GET /images/:id (public, opaque id)

POST   /webhooks/mock                POST /webhooks/razorpay        (payment provider only, signature-verified)
```

---

## 8. Production deployment

**One-click on Render:** the repository root has `render.yaml` (a "Blueprint"). Render → New →
Blueprint → point at your repo. It provisions a free Postgres database and a web service together,
wires `DATABASE_URL` automatically, and runs migrations on every deploy
(`node dist/db/migrate.js && node dist/server.js`, see `Dockerfile`/`package.json`). You still need to
set `PUBLIC_BASE_URL` and the `RAZORPAY_*` secrets yourself in the Render dashboard (marked
`sync: false` in `render.yaml` so they're never committed to git).

**Anywhere else that runs Node + Docker** (Railway, Fly.io, a VPS, ...): build the `Dockerfile`, provide
`DATABASE_URL` pointing at a Postgres 14+ instance, and set the same environment variables as local
dev but with `NODE_ENV=production`, `DATABASE_SSL=true` (most managed Postgres requires it),
`PAYMENT_PROVIDER=razorpay`, and real Razorpay keys. `npm run build && npm start` runs migrations then
starts the server (see the `start` script and `Dockerfile`'s `CMD`).

Point the mobile app's `EXPO_PUBLIC_API_BASE_URL` at your deployed API's `https://` address and
rebuild (see `../mobile/README.md`).

---

## 9. Testing

```bash
npm test              # billing maths + subscription state machine (18 tests, no database needed)
npm run typecheck      # TypeScript across the whole backend
```
`tests/unit/money.test.ts` checks the exact billing examples from the brief (2×₹60=₹120, partial
payments, price-history isolation, no floating-point drift, and more). `tests/unit/stateMachine.test.ts`
checks every subscription transition, including the two properties that matter most for real money:
duplicate/out-of-order webhooks never move access backwards, and a failed charge never cuts access
before the grace period the customer already paid for ends.

**What is not run in this environment:** these tests run against pure functions only — there is no
PostgreSQL available here to run an end-to-end integration test. Before relying on this in production,
run through the full flow yourself once locally: register a shopkeeper, create a shop, subscribe via
the mock checkout, add a product, add a customer, create a bill, record a partial payment, then check
the customer account sees the same bill and khata balance.

---

## 10. Security checklist

- [x] argon2id password hashing
- [x] short-lived signed access tokens + rotating, hashed refresh tokens with reuse detection
- [x] per-route rate limiting (auth endpoints tighter than general API traffic)
- [x] input validation on every endpoint (zod schemas in `src/validators/`)
- [x] parameterized SQL everywhere (no string-built queries against user input; a handful of
      dynamic `UPDATE ... SET` column lists are built only from a fixed, hard-coded allow-list of
      column names, never from request bodies directly — see the `ALLOWED` sets in `repositories/`)
- [x] role + shop-membership + subscription checks on every protected route, enforced server-side
- [x] secure HTTP headers (`helmet`) + CORS closed by default (mobile apps don't need it; open
      `CORS_ORIGINS` only if you build a web admin panel later)
- [x] webhook signature verification over the raw request body, with idempotent processing
- [x] no secrets in the mobile bundle; `.env` git-ignored; `.env.example` has placeholders only
- [x] server-side subscription verification (§6)

## 11. Scalability notes
Indexes on every foreign key and search column (see the bottom of `migrations/001_init.sql`), a
connection pool (`DB_POOL_MAX`), pagination-friendly `LIMIT`s on list endpoints, and a stateless API
(sessions live in Postgres, not in server memory, so you can run more than one instance behind a load
balancer without sticky sessions). This is intentionally a single well-organised service (a "modular
monolith" — `controllers` → `services` → `repositories`), not microservices; split it up later only if
you actually need to.

## 12. Known limitations / decisions you may want to revisit
- **Realtime updates removed.** The old Supabase version pushed new shopping lists to the shopkeeper's
  screen live. This backend has no WebSocket/realtime layer; the app instead reloads on pull-to-refresh
  and whenever a screen regains focus. Adding realtime later (e.g. with `socket.io` or Server-Sent
  Events) would be a self-contained addition to this service.
- **A lapsed subscription doesn't hide the shop from customers.** Only shop-management endpoints are
  gated; customers can still browse and send a list to a shop whose owner hasn't paid this month. If
  you'd rather hide such shops from `GET /shops` entirely, that's a one-line change in `shopRepo.listActiveShops`/`searchShops` (add `and exists (select 1 from subscriptions ... access_until > now())`).
- **Images are stored in Postgres** (`images.data bytea`), capped at 2 MB, served publicly by opaque
  UUID (no auth on `GET /images/:id`, matching how a CDN behaves — nothing sensitive is stored there).
  Fine at small-to-medium scale; move to S3/Cloudflare R2 later if image traffic grows.
- **One Razorpay `total_count`.** Razorpay subscriptions need a bounded number of billing cycles;
  100 (~8 years) is used as an effectively-indefinite value. If a shop somehow reaches it, resubscribing
  is just running checkout again.
