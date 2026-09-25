# Vendly

A multi-shop grocery/khata platform. Shopkeepers list products and manage billing for a ₹1,000/month
subscription; customers browse shops, compare prices, send shopping lists, and track what they owe.

**Backend is entirely independent — no Supabase, no Firebase, no other BaaS.** It's a plain
Node.js + TypeScript + Express + PostgreSQL service you run and own yourself, with its own JWT
authentication and a pluggable payment provider (Razorpay, or a safe built-in mock for testing).

```
mobile/    React Native (Expo) app — customer and shopkeeper experiences, Android + iOS
backend/   Node.js API — auth, shops, billing, khata, subscriptions, Razorpay webhooks
docs/      Privacy policy & terms templates
render.yaml  One-click deploy blueprint for the backend (Render)
```

## Start here
1. **Backend first:** `backend/README.md` — Docker Postgres, migrations, a seed script with demo
   logins, then `npm run dev`.
2. **Then the app:** `mobile/README.md` — point it at the backend's address, `npx expo start`, scan
   the QR code with Expo Go.

Both READMEs have full step-by-step setup, a complete list of environment variables, how to test the
customer and shopkeeper flows (including subscribing with the built-in mock payment provider — no
real money or Razorpay account needed to test), and production deployment steps.

## What's genuinely tested vs. not yet run
| | |
|---|---|
| Billing maths (backend + mobile) | **Tested** — `npm test` in each folder |
| Subscription state machine (webhooks, renewals, grace period) | **Tested** — `npm test` in `backend/` |
| TypeScript, both projects | **Checked** clean |
| The full app against a live database and a phone | **Not run in this environment** — there's no PostgreSQL or Expo Go available here. Please run through §4 of `mobile/README.md` yourself before publishing. |

## The short version of the architecture
```
Mobile app (Expo)  →  Vendly API (Express)  →  PostgreSQL
                              ↕
                     Razorpay (or the mock provider for testing)
```
Full detail — schema, every endpoint, the exact webhook → subscription-state flow, security notes,
and known limitations — is in `backend/README.md`.
