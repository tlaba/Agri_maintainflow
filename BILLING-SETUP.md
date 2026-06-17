# Turn on Pro billing (Stripe) for MaintainFlow Ag

Pro is **server-verified**: a Cloud Function grants it by writing
`entitlements/{uid}`, which the app can read but **cannot write** (see
`firestore.rules`). So Pro can't be faked from the browser.

Until you finish these steps the app falls back to the local "Activate Pro
(evaluation)" toggle, so nothing breaks meanwhile. (Requires the **Blaze**
plan for Cloud Functions — you already have it.)

How it works: the app calls the **`createCheckoutSession`** Cloud Function,
which returns a hosted **Stripe Checkout** URL; the browser redirects there.
On a successful payment Stripe calls **`stripeWebhook`**, which verifies the
signature and writes `entitlements/{uid}` with `proUntil = now + PRO_DAYS`.
No Stripe.js or publishable key is needed in the browser — the only Stripe key
that exists is the **secret** key, kept in the function's secrets.

> This is a **one-off payment per period** (renew by paying again) — simple and
> predictable. Recurring subscriptions can be added later via Stripe Billing.

---

## 1. Create a Stripe account (Canada)
1. Sign up at <https://dashboard.stripe.com/register>, business country **Canada**,
   and complete activation (business + bank details for payouts).
2. **Developers → API keys.** You'll use the **Secret key** (`sk_test_…` to start).
   The publishable key is **not** needed by this app.

## 2. Deploy the Cloud Functions
You need the Firebase CLI once: `npm i -g firebase-tools` then `firebase login`.

```bash
cd functions && npm install && cd ..
firebase use maintainflow-ag         # your project id

# Secret (server-only — never in the app):
firebase functions:secrets:set STRIPE_SECRET_KEY     # paste your Stripe SECRET key (sk_test_…)

# Optional price/currency (defaults: 499 cents / usd = US$4.99):
#   set PRO_PRICE_CENTS / PRO_CURRENCY as deploy params if you change them.

# First deploy (the webhook secret comes in step 3, then redeploy):
firebase deploy --only functions,firestore:rules
```
Deploy prints the function URLs — note the **`stripeWebhook`** URL, e.g.
`https://us-central1-maintainflow-ag.cloudfunctions.net/stripeWebhook`.

## 3. Add the Stripe webhook + its signing secret
Stripe Dashboard → **Developers → Webhooks → Add endpoint**:
- **Endpoint URL** = the `stripeWebhook` URL from step 2.
- **Events to send** (select all three):
  - `checkout.session.completed` — grants Pro on payment
  - `charge.refunded` — revokes Pro on refund
  - `charge.dispute.created` — revokes Pro on chargeback/dispute
- Save, then copy the endpoint's **Signing secret** (`whsec_…`).

Set it and redeploy so the webhook can verify signatures:
```bash
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # paste the whsec_… value
firebase deploy --only functions
```

## 4. Turn billing on in the app
Edit **`js/billing-config.js`**:
```js
window.MFAG_BILLING = {
  provider: "stripe",
  enabled: true,                      // <- flip to true now that the function is live
  displayPrice: "US$4.99 / 30 days",  // button label only; keep in sync with the server amount
  functionsRegion: "us-central1"
};
```
`displayPrice` is just the button text — the real charge is set server-side by
`PRO_PRICE_CENTS` / `PRO_CURRENCY`. Keep them in sync.

## 5. Test (with test keys)
1. Open the deployed app, **sign in** (Pro is tied to the account).
2. **Money → Plan → Get Pro** (or More → Settings → Plan) → you're redirected to
   Stripe Checkout.
3. Pay with a Stripe [test card](https://stripe.com/docs/testing): `4242 4242 4242 4242`,
   any future expiry, any CVC/postal code.
4. You're redirected back to the app (`/?pro=1`); the webhook grants Pro and the
   app unlocks it within a second or two.
5. **Verify server-side:** Firebase Console → Firestore → `entitlements/{your-uid}`
   shows `pro: true` and a `proUntil` ~30 days out.

✅ If that document appears, the whole chain (checkout → webhook → entitlement →
unlock) works.

## 6. Go live
1. In Stripe, toggle to **live mode**; activate the account if not already.
2. Re-set the **live** secret + (live) webhook signing secret and redeploy:
   ```bash
   firebase functions:secrets:set STRIPE_SECRET_KEY       # sk_live_…
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET   # whsec_… from the LIVE webhook endpoint
   firebase deploy --only functions
   ```
   (Add a webhook endpoint in **live** mode too — step 3, live.)
3. Keep `enabled: true` in `billing-config.js`.
4. Do one small **real** card payment to confirm, then you're live. 💳

---

## Notes
- **Currency:** Stripe (Canada) settles in CAD; you can charge in many currencies
  (default here is USD). Stripe does **not** support BWP, and a Canada-based Stripe
  account can't take Botswana mobile money (Orange Money / MyZaka) — for those
  customers add a separate mobile-money flow.
- Pro is tied to the **account**, so it follows the farmer across devices.
- To revert to evaluation mode, set `enabled: false` in `billing-config.js`.
- Function logs for debugging: `firebase functions:log`.
