# Tax Diary

Malaysian individual income tax (YA2026) relief tracker. Free, donation-supported, local-first PWA.

This is a **Vite + React + Tailwind** scaffold around the canonical `App.jsx`
(ported verbatim from the `MintCukai-v2.jsx` artifact). No backend yet —
this build is **local-storage only**, per the agreed deployment sequencing.
Firebase Auth/Firestore and the Cloud Function OCR proxy are a follow-up.

## 1. Install dependencies

This sandbox has no network access, so nothing has been installed yet.
On your own machine, from this folder:

```bash
npm install
```

## 2. Run locally

```bash
npm run dev
```

Opens at `http://localhost:5173`. Service workers only activate in
production builds (see `src/main.jsx`), so PWA install/offline behavior
won't show up in `dev` — use `preview` (step 3) to test that.

## 3. Build + preview the production bundle

```bash
npm run build
npm run preview
```

`npm run preview` serves the real `dist/` build over `http://localhost:4173`,
which is where you can verify:
- the service worker registers (DevTools → Application → Service Workers)
- "Add to Home Screen" / install prompt appears
- the app still works with the network tab set to "Offline"

## 4. Deploy (static hosting, no backend required)

Any of these work with zero config changes since this is a plain static build:

**Vercel**
```bash
npm i -g vercel   # one-time, needs network
vercel --prod
```
Framework preset: Vite. Build command `npm run build`, output dir `dist`.

**Netlify**
```bash
npm i -g netlify-cli   # one-time, needs network
netlify deploy --prod --dir=dist
```

**Firebase Hosting**
```bash
npm i -g firebase-tools   # one-time, needs network
firebase login
firebase init hosting     # public dir: dist, single-page app: yes
npm run build
firebase deploy --only hosting
```
Using Firebase Hosting now costs nothing extra and sets you up cleanly for
wiring in Firebase Auth + Firestore in the follow-up session.

All three give you HTTPS by default, which service workers require.

## AI Receipt Scanner setup (real OCR, not the old fallback)

`api/scan-receipt.js` is a Vercel Serverless Function that proxies the
Gemini call server-side, so the API key never reaches the browser. To
turn it on:

1. Get a free Gemini API key at [aistudio.google.com](https://aistudio.google.com/apikey)
2. In your Vercel project → **Settings → Environment Variables**, add:
   - Name: `GEMINI_API_KEY`
   - Value: (paste your key)
   - Environment: Production (and Preview if you want it there too)
3. Redeploy (Vercel → Deployments → ⋯ → Redeploy, or just push any new commit)

No local `.env` needed since you're not running this locally — the key
only ever lives in Vercel's environment variable store.

If the key is missing or a scan fails for any reason, the app now falls
back honestly to manual entry (with the photo attached) instead of
silently filling in fake placeholder data — that fake-data fallback from
the artifact version has been removed.

## Firebase Authentication (Stage A — done)

Real email/password sign-up and sign-in, replacing the old demo stub that
accepted any string containing `@`. Powered by Firebase Auth — config lives
in `src/firebase.js` (safe to be public/client-side, unlike the Gemini key).

To test: Settings → Devices tab (requires Plus/trial) → create an account
or sign in. Wrong passwords, duplicate emails, weak passwords, etc. all
show real, specific error messages now instead of silently succeeding.

## Firestore Cloud Sync (Stage B — done)

Real cross-device sync, replacing the old manual 6-character "Vault Code"
(which never worked outside the artifact sandbox, and was only as secure
as whoever could see/guess the code even when it did).

**How it works now:** each signed-in account's data lives in Firestore at
`users/{their-firebase-uid}`. Sign in with the same email/password on any
device, and your data just appears — no code to copy/paste. On first
sign-in anywhere, whatever's on that device gets pushed up as the initial
cloud backup; every device after that pulls the cloud copy down and keeps
it in sync automatically as you make changes.

**Setup required in Firebase Console (one-time):**
1. Databases & Storage → Firestore Database → confirm the database exists
   (you already created this)
2. Firestore Database → **Rules** tab → replace the contents with what's
   in `firestore.rules` in this repo → **Publish**

This is the part that actually enforces "only you can read your own
data" — without publishing these rules, Firestore's default rules may
block all access (safe but useless) or, in test mode, allow anyone to
read/write anything (functional but unsafe). Publishing the rules in this
repo gets you both working *and* safe.

**To test after deploying:** sign in on this device, add a receipt, sign
out, sign in again (or on a second device/browser) with the same account
— the receipt should be there. Check Settings → Devices tab for a
"Synced" status with a timestamp.

## Payment Gateway — ToyyibPay (Stage C — done)

Real payment collection for the Plus subscription (RM29/year flat), replacing
the old `subscribe()` stub that just granted Plus for free with one click.

**How it works:** tapping "Subscribe" now calls a server function
(`api/create-payment.js`) that creates a ToyyibPay payment tied to your
signed-in Firebase account, then redirects you to ToyyibPay's hosted
checkout (FPX or card). Once you pay, ToyyibPay calls a second server
function (`api/toyyibpay-callback.js`) directly — not your browser — to
confirm the payment. That function verifies the request is genuinely from
ToyyibPay (via their documented hash formula) before marking your account
as paid in Firestore, using elevated "admin" access your normal login
doesn't have. The app then picks up your Plus status in real time.

**This also fixes a real security gap**: Plus status now lives at
`users/{uid}/private/billing` in Firestore, which — per the updated
`firestore.rules` — you can *read* but can *never write directly*, even
signed in as yourself. Only the trusted server-side webhook can set it.
Before this, `isPro` was just a local flag anyone could flip via browser
dev tools.

**Setup required (all in Vercel → Settings → Environment Variables):**

| Variable | Where to get it |
|---|---|
| `TOYYIBPAY_SECRET_KEY` | ToyyibPay dashboard → your account settings |
| `TOYYIBPAY_CATEGORY_CODE` | ToyyibPay dashboard → the Category you created |
| `TOYYIBPAY_BASE_URL` | Optional. Omit for production (defaults to `https://toyyibpay.com`). Set to `https://dev.toyyibpay.com` to test against ToyyibPay's sandbox first — recommended before going live. |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Firebase Console → Project Settings → Service Accounts → "Generate new private key". Paste the **entire downloaded JSON file's contents** as the value, exactly as-is. |
| `APP_URL` | Optional. Omit and it'll auto-detect from the request; set explicitly (e.g. `https://tax-diary.vercel.app`) if you ever see callback/return URL issues. |
| `REDEEM_CODES` | Comma-separated list of valid beta/discount codes, e.g. `TAXDIARYBETA,FAMILY2026`. Case-insensitive. Edit anytime in Vercel — no redeploy from GitHub needed, just save the env var and it applies on the next request. |

**Redeem codes** (`api/redeem-code.js`) grant Plus the same way a real
payment does — same Firestore path, same "extend from current expiry, not
from now" logic if already on Plus — just gated by a shared secret instead
of ToyyibPay. Useful for beta testers or anyone you want to comp before
turning on real payments broadly. Shown as a small "Have a code?" field in
the paywall.

**Also required — update Firestore rules again** (they changed in this
stage): Firebase Console → Firestore Database → Rules tab → replace with
the new contents of `firestore.rules` in this repo → Publish. The new
version adds the `private/billing` path that only the server can write.

**To test:** use the ToyyibPay sandbox first (`TOYYIBPAY_BASE_URL` = dev
URL above) — sandbox payments use bank simulators, not real money. Once
that round-trip works, switch back to the production URL for real
payments.

**One UX limitation worth knowing:** ToyyibPay requires a phone number
field, which the app doesn't currently collect from users — a placeholder
value is sent instead. Purely cosmetic (shows on ToyyibPay's checkout
page, doesn't block payment), but worth knowing if a user asks about it.

## Donation Link

Swap the placeholder in `src/App.jsx` (search for `DONATION_URL`, near the
top of the file) for a real ToyyibPay **open-amount** payment link —
create one from your ToyyibPay dashboard (no code, they let the payer
choose how much to give). This is a one-line change — you can edit it
directly on GitHub (tap the pencil icon on the file) rather than
re-uploading the whole file.

## ⚠️ Still not fully closed

1. **Free trial is still purely local/client-side**, unlike the paid
   subscription. Since it doesn't move money, a determined user could
   still reset it locally — lower stakes than the payment flow, but worth
   knowing it wasn't hardened in this pass. Same pattern as the payment
   fix (a small server function + Firestore write) would close this if it
   ever becomes a real problem.
2. **No refund handling.** If a payment fails after the fact (chargeback,
   etc.), there's no code to walk back a Plus grant — not something
   ToyyibPay's flow surfaces automatically either way.

There's also one latent bug worth a look independent of deployment: in
`store.set()`, the `window.storage` branch calls
`window.storage.set(k, shared)` — missing the `v` (value) argument. It's
currently dead code (since `window.storage` never exists outside the
artifact sandbox), so it's harmless today, but worth fixing if any future
code path ever relies on it.

## Deferred (intentional, not bugs)

- Home loan interest relief doesn't enforce the "first 3 consecutive years"
  rule — shown as a note only.
- Per-child relief attribution is all-or-nothing per parent, not per-child.
- Professional body subscription (a deduction, not a relief) isn't modeled.

## Project structure

```
tax-diary/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── public/
│   ├── manifest.json       # PWA manifest
│   ├── sw.js                # hand-written service worker (stale-while-revalidate)
│   └── icons/                # placeholder icons — swap these for real artwork
├── src/
│   ├── main.jsx             # React root + SW registration
│   ├── App.jsx               # the app itself (ported from MintCukai-v2.jsx)
│   └── index.css             # Tailwind directives
```
