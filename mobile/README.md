# Vendly (mobile app)

React Native + Expo. Talks only to the **Vendly API** (in `../backend`) — no Supabase, no Firebase,
no Google sign-in. Login is plain email + password, held as a JWT session.

## 1. Install
```bash
npm install
npx expo install --fix
```

## 2. Connect the backend
```bash
cp .env.example .env
```
Set `EXPO_PUBLIC_API_BASE_URL` to your computer's LAN address (not `localhost` — that means the phone
itself). Find it:
```bash
# Mac:     ipconfig getifaddr en0
# Windows: ipconfig            (look for "IPv4 Address")
# Linux:   hostname -I
```
e.g. `EXPO_PUBLIC_API_BASE_URL=http://192.168.1.42:4000`. Make sure the backend is running first (see
`../backend/README.md` — `npm run migrate && npm run seed && npm run dev`) and that your phone and
computer are on the same Wi-Fi network.

## 3. Run it
```bash
npx expo start -c
```
Scan the QR code with the **Expo Go** app. You'll land on the Vendly welcome screen.

## 4. Test the full flow
Use the demo accounts `npm run seed` printed (in the backend), or create your own:
1. **Customer:** Welcome → Customer → Sign up → browse the seeded shop → add items to a list → send it.
2. **Shopkeeper:** Welcome → Shopkeeper → Sign up → fill in shop details → you'll land on the
   **Subscribe** screen (a real shopkeeper account always needs an active subscription to manage a
   shop — this is enforced by the server, not just hidden in the app). Tap **Subscribe now**; with the
   backend's default `PAYMENT_PROVIDER=mock`, this opens a safe test checkout page with "Simulate
   successful payment" / "Simulate failed payment" buttons — no real money, no Razorpay account needed.
   After simulating success, pull to refresh (or wait a couple of seconds) and the dashboard unlocks.
3. As the shopkeeper: add a product, then (as the customer) send a list for it, then (as the
   shopkeeper) turn that list into a bill and record a payment.

If you used the seeded shopkeeper account (`owner@vendly.test`), its subscription is already marked
active by the seed script, so you can skip straight to managing the shop.

## 5. Tests & type-check
```bash
npm test            # billing maths (11 tests)
npm run typecheck    # TypeScript across the app
```

---

## What changed from the previous (Supabase) version
- **Backend:** entirely replaced. All data now lives behind the Vendly API (`../backend`) —
  PostgreSQL, not Supabase; email/password + JWT, not Supabase Auth/Google; a real payment flow, not a
  free-for-all. `src/lib/supabase.ts` is gone; every screen calls `src/lib/api.ts`, which talks to the
  new REST API through `src/lib/apiClient.ts`.
- **Sign-in:** email + password (`app/auth.tsx`), not "Continue with Google". Sessions are stored the
  same secure way as before (chunked into the phone's Keychain/Keystore via `expo-secure-store`), just
  holding a JWT access/refresh pair instead of a Supabase session.
- **Accounts:** choosing Customer or Shopkeeper now happens **before** signing up (on the welcome
  screen) and is fixed on the account from then on — there's no later "become a shopkeeper" step.
- **New:** a subscription paywall (`app/subscribe.tsx`) for shopkeepers, and an owner-name field
  in shop setup (the backend requires it).
- **Removed:** the live "a new list just arrived" push while sitting on the incoming-lists screen
  (no realtime layer in the new backend — pull to refresh or switch tabs instead). Product/shop
  pictures are now served from the backend's own database by an id, instead of Supabase Storage.
- **Design:** unchanged. Same pastel palette, calligraphic titles, moving text, and screen layouts —
  see `src/theme.ts`.

## Folder map
```
app/                     screens (Expo Router)
  (auth)/                welcome (role choice), create-shop
  auth.tsx                combined sign-up / log-in form
  subscribe.tsx           the ₹1,000/month paywall for shopkeepers
  (customer)/             Shops, Compare, My lists, Khata, Me
  (shop)/                 Home, Lists, Bill, Stock, Khata
  store/[id] · list/[id] · bill/[id] · ledger/[id] · product/edit
src/
  theme.ts                colours, fonts, shapes — change the look here
  components/              UI kit + moving-text components
  lib/
    apiClient.ts           fetch wrapper: attaches the JWT, refreshes it once on a 401
    secureTokens.ts        chunked, encrypted on-device token storage
    auth.tsx                session state, login/register/logout, active shop + subscription status
    api.ts                  every backend call, one function per endpoint
    money.ts                paise-precise money maths (mirrors the backend's)
```

## Publishing the app
Same as before — this part doesn't depend on the backend choice:
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build -p android --profile preview      # a shareable test APK
eas build -p android --profile production    # for the Play Store
eas build -p ios --profile production         # needs an Apple Developer account
```
Before a real release: change `app.json`'s `ios.bundleIdentifier` / `android.package` to your own
(`com.vendly.app` is a placeholder), point `EXPO_PUBLIC_API_BASE_URL` at your **deployed** backend
(`https://...`, see `../backend/README.md` §8), and switch that backend to
`PAYMENT_PROVIDER=razorpay` with real keys. You'll also need a public privacy policy and terms page
(templates in `../docs/`) and a support email, referenced from `.env` as `EXPO_PUBLIC_PRIVACY_URL` /
`EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_SUPPORT_EMAIL`.
