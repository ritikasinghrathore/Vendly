# Vendly API

A standalone Node.js backend: Express + TypeScript + PostgreSQL + JWT auth. No Supabase, no Firebase,
no other BaaS, no payment provider — this is a free service you run and control yourself.

```
Mobile app (Expo)  --HTTPS-->  Vendly API (this folder)  --SQL-->  PostgreSQL
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
Shopkeeper: owner@vendly.test    (shop: Ritika General Store, ready to manage immediately)
Customer:   customer@vendly.test
Password (both): Password123!
```

Check it's alive: `curl http://localhost:4000/health` → `{"ok":true,...}`.

### Connecting the mobile app
In `../mobile/.env`, set `EXPO_PUBLIC_API_BASE_URL` to an address your **phone** can reach — not
`localhost` (that means the phone itself). Find your computer's LAN IP and use e.g.
`http://192.168.1.42:4000`, or point it at your deployed backend's `https://` address. Full steps are
in `../mobile/README.md`.

---

## 2. Environment variables

All in `.env` (copy from `.env.example`). Never commit `.env` — `.gitignore` already excludes it.

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `JWT_ACCESS_SECRET` | Signs access tokens. Generate one: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | Session lifetime (15 min / 30 days by default) |
| `PUBLIC_BASE_URL` | This API's own public address |
| `DATABASE_SSL` | Set `true` for hosted databases that require SSL (Render, Neon, most managed Postgres) |
| `TRUST_PROXY` | Number of reverse proxies in front of the API (Render = 1) — needed for correct rate limiting |

No secret (JWT key, database password) is ever sent to the mobile app — the app only ever holds
`EXPO_PUBLIC_API_BASE_URL`, a plain address.

---

## 3. Database

`migrations/001_init.sql` creates every table with foreign keys and indexes; `002_seed_categories.sql`
adds the default product categories. `npm run migrate` applies whatever hasn't run yet (tracked in a
`schema_migrations` table) — safe to run repeatedly, including as part of deploys.

**Tables:** `users`, `sessions`, `refresh_tokens`, `images`, `shops`, `shop_members`, `categories`,
`products`, `inventory`, `product_price_history`, `inventory_movements`, `shop_customers`,
`shopping_lists`, `shopping_list_items`, `bills`, `bill_items`, `customer_payments`,
`customer_payment_allocations`, `khata_transactions`, `notifications`.

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

Vendly is **free for both roles**. There is no subscription, no payment provider, and no paywall
anywhere in the codebase.

```
Customer:                                  Shopkeeper:
Register/Login (role=customer)             Register/Login (role=shopkeeper)
  → browse shops                             → shop setup (name, address, phone, ...)
                                              → shop management unlocked immediately
```

Every management endpoint (products, stock, billing, customers, khata, dashboard) only requires
`requireRole('shopkeeper')` + shop membership (`loadShopMembership`) — see `src/middleware/`.

---

## 6. API endpoints

All under `/api/v1`. 🔒 = requires `Authorization: Bearer <access token>`. 🏪 = shopkeeper role +
shop membership.

```
POST   /auth/register              /auth/login              /auth/refresh
POST   /auth/logout 🔒              /auth/logout-all-others 🔒
GET    /auth/me 🔒                  PATCH /auth/me 🔒          DELETE /auth/me 🔒
POST   /auth/change-password 🔒

GET    /shops 🔒                    (browse/search active shops)
POST   /shops 🔒 (shopkeeper)       GET /shops/mine 🔒 (shopkeeper)
GET    /shops/:id 🔒                PATCH /shops/:id 🏪
GET    /shops/:id/dashboard 🏪      GET /shops/:id/sales-summary 🏪

GET    /categories 🔒               GET /products/search?q= 🔒
GET    /shops/:id/products 🔒       POST /shops/:id/products 🏪
GET    /shops/:id/products/:pid 🔒  PATCH /shops/:id/products/:pid 🏪
POST   /shops/:id/products/:pid/stock 🏪

GET    /shops/:id/lists/draft 🔒 (customer)   PUT /shops/:id/lists/draft/items 🔒 (customer)
GET    /lists/mine 🔒 (customer)               GET /lists/:id 🔒
PATCH  /lists/:id/notes 🔒 (customer)          DELETE /lists/:id 🔒 (customer)
POST   /lists/:id/submit 🔒 (customer)
GET    /shops/:id/lists/incoming 🏪            POST /shops/:id/lists/:id/view 🏪

GET    /shops/:id/customers 🏪                 GET /shops/:id/customers/search 🏪
POST   /shops/:id/customers 🏪                 POST /shops/:id/bills 🏪
POST   /shops/:id/customers/:id/payments 🏪    POST /shops/:id/customers/:id/adjustments 🏪
GET    /bills/:id 🔒                           GET /shop-customers/:id/ledger 🔒
GET    /khata/mine 🔒 (customer)

GET    /notifications 🔒            GET /notifications/unread-count 🔒
POST   /notifications/mark-all-read 🔒
POST   /images 🔒                    GET /images/:id (public, opaque id)
```

---

## 7. Production deployment (Render + Neon, both free)

**Use a permanent free database.** Render's own free Postgres is deleted 30 days after it's created,
which would wipe real customers' bills and khata. **Neon** (neon.tech) has a genuinely permanent free
Postgres (no card, no expiry — it just sleeps when idle and wakes on the next request).

1. **Database:** on neon.tech create a project. Copy its connection string and use the **direct**
   host (the one *without* `-pooler` in the name) — the migration step takes a lock that the pooled
   host can silently break. Use `?sslmode=verify-full` at the end.
2. **Server:** on Render → New → Blueprint → pick your repository (uses `render.yaml`). When it asks,
   paste the Neon string as `DATABASE_URL`, and set `PUBLIC_BASE_URL` to the service's own
   `https://<name>.onrender.com` address (Render shows it once the service exists).
3. Every deploy runs `node dist/db/migrate.js && node dist/server.js`: new migrations are applied
   automatically, and ones already applied are skipped (tracked in the `schema_migrations` table).
4. **Do not run `npm run seed` against production** — it creates demo accounts with a publicly known
   password. Real users just register in the app; the default categories come from migration 002.

Free-tier things to know: Render's free server sleeps after 15 minutes idle (the next request takes
about a minute to wake it), and Neon's free storage is about 0.5 GB. Shop/product pictures are stored
in the database (max 2 MB each), so many large pictures will use that up faster than text data does.

**Anywhere else that runs Node** (Railway, Fly.io, a VPS, ...): build with `npm run build`, provide
`DATABASE_URL` pointing at a Postgres 14+ instance, and set the same environment variables as local
dev but with `NODE_ENV=production` and `DATABASE_SSL=true`. `npm run build && npm start` runs
migrations then starts the server.

Point the mobile app's `EXPO_PUBLIC_API_BASE_URL` at your deployed API's `https://` address and
rebuild (see `../mobile/README.md`).

---

## 8. Testing

```bash
npm test              # billing maths (8 tests, no database needed)
npm run typecheck      # TypeScript across the whole backend
```
`tests/unit/money.test.ts` checks the exact billing examples from the brief (2×₹60=₹120, partial
payments, price-history isolation, no floating-point drift, and more).

**What is not run in this environment:** these tests run against pure functions only — there is no
PostgreSQL available here to run an end-to-end integration test. Before relying on this in production,
run through the full flow yourself once locally: register a shopkeeper, create a shop, add a product,
add a customer, create a bill, record a partial payment, then check the customer account sees the same
bill and khata balance.

---

## 9. Security checklist

- [x] argon2id password hashing
- [x] short-lived signed access tokens + rotating, hashed refresh tokens with reuse detection
- [x] per-route rate limiting (auth endpoints tighter than general API traffic)
- [x] input validation on every endpoint (zod schemas in `src/validators/`)
- [x] parameterized SQL everywhere (no string-built queries against user input; a handful of
      dynamic `UPDATE ... SET` column lists are built only from a fixed, hard-coded allow-list of
      column names, never from request bodies directly — see the `ALLOWED` sets in `repositories/`)
- [x] role + shop-membership checks on every protected route, enforced server-side
- [x] secure HTTP headers (`helmet`) + CORS closed by default (mobile apps don't need it; open
      `CORS_ORIGINS` only if you build a web admin panel later)
- [x] no secrets in the mobile bundle; `.env` git-ignored; `.env.example` has placeholders only

## 10. Scalability notes
Indexes on every foreign key and search column (see the bottom of `migrations/001_init.sql`), a
connection pool (`DB_POOL_MAX`), pagination-friendly `LIMIT`s on list endpoints, and a stateless API
(sessions live in Postgres, not in server memory, so you can run more than one instance behind a load
balancer without sticky sessions). This is intentionally a single well-organised service (a "modular
monolith" — `controllers` → `services` → `repositories`), not microservices; split it up later only if
you actually need to.

## 11. Known limitations / decisions you may want to revisit
- **No payment or subscription system.** Vendly is free for every account. If you want to charge
  shopkeepers later, that's a self-contained addition (a `subscriptions` table, a payment provider,
  and a middleware gate on the shop-management routes) rather than a rewrite of anything here.
- **Realtime updates removed.** There's no WebSocket/realtime layer; the app reloads on pull-to-refresh
  and whenever a screen regains focus.
- **Images are stored in Postgres** (`images.data bytea`), capped at 2 MB, served publicly by opaque
  UUID (no auth on `GET /images/:id`, matching how a CDN behaves — nothing sensitive is stored there).
  Fine at small-to-medium scale; move to S3/Cloudflare R2 later if image traffic grows.
