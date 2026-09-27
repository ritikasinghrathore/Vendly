# Vendly

A multi-shop grocery/khata platform. Shopkeepers list products and manage billing for free; customers
browse shops, compare prices, send shopping lists, and track what they owe.

**Backend is entirely independent — no Supabase, no Firebase, no other BaaS, no payment provider.**
It's a plain Node.js + TypeScript + Express + PostgreSQL service you run and own yourself, with its
own JWT authentication.

```
mobile/    React Native (Expo) app — customer and shopkeeper experiences, Android + iOS
backend/   Node.js API — auth, shops, products/stock, shopping lists, billing, khata
docs/      Privacy policy & terms templates
render.yaml  One-click deploy blueprint for the backend (Render)
```

## Start here
1. **Backend first:** `backend/README.md` — Docker Postgres, migrations, a seed script with demo
   logins, then `npm run dev`.
2. **Then the app:** `mobile/README.md` — point it at the backend's address, `npx expo start`, scan
   the QR code with Expo Go.

Both READMEs have full step-by-step setup, a complete list of environment variables, how to test the
customer and shopkeeper flows, and production deployment steps.

## What's genuinely tested vs. not yet run
| | |
|---|---|
| Billing maths (backend + mobile) | **Tested** — `npm test` in each folder |
| TypeScript, both projects | **Checked** clean |
| The full app against a live database and a phone | **Not run in this environment** — there's no PostgreSQL or Expo Go available here. Please run through §4 of `mobile/README.md` yourself before publishing. |

## The short version of the architecture
```
Mobile app (Expo)  →  Vendly API (Express)  →  PostgreSQL
```
Full detail — schema, every endpoint, security notes, and known limitations — is in
`backend/README.md`.
