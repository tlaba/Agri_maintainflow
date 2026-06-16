# Turn on Pro billing (Flutterwave) for MaintainFlow Ag

Pro is **server-verified**: a Cloud Function grants it by writing
`entitlements/{uid}`, which the app can read but **cannot write** (see
`firestore.rules`). So Pro can't be faked from the browser.

Until you finish these steps the app falls back to the local "Activate Pro
(evaluation)" toggle, so nothing breaks meanwhile. (Requires the **Blaze**
plan — you already have it.)

---

## 1. Create a Flutterwave account
1. Sign up at <https://flutterwave.com> and complete business verification.
2. Dashboard → **Settings → API keys**. Note your **Public key** and
   **Secret key** (use **test** keys first).

## 2. Add the public key to the app
Edit **`js/billing-config.js`**:
```js
window.MFAG_BILLING = {
  flwPublicKey: "FLWPUBK_TEST-xxxxxxxx-X",  // public key — safe in the browser
  priceBWP: 49, currency: "BWP", days: 30,
  functionsRegion: "us-central1"
};
```
`priceBWP` / `currency` / `days` **must match** the function's
`PRO_PRICE` / `PRO_CURRENCY` / `PRO_DAYS`.

## 3. Deploy the Cloud Functions
You need the Firebase CLI once: `npm i -g firebase-tools` then `firebase login`.

```bash
cd functions && npm install && cd ..
firebase use maintainflow-ag         # your project id

# Secrets (server-only — never in the app):
firebase functions:secrets:set FLW_SECRET_KEY      # paste your Flutterwave SECRET key
firebase functions:secrets:set FLW_WEBHOOK_HASH    # any strong random string you choose

# Optional price/currency (defaults: 49 / BWP):
# set PRO_PRICE / PRO_CURRENCY as params at deploy if you change them

firebase deploy --only functions,firestore:rules
```
Deploy prints two URLs — note the **`flwWebhook`** URL.

## 4. Point Flutterwave at the webhook
Flutterwave Dashboard → **Settings → Webhooks**:
- **URL** = the deployed `flwWebhook` URL.
- **Secret hash** = the exact string you set for `FLW_WEBHOOK_HASH`.

## 5. Test
1. With **test** keys, open the app, sign in, **Money → Upgrade to Pro → Get Pro**.
2. Pay with a Flutterwave [test card / test mobile money](https://developer.flutterwave.com/docs/test-cards).
3. The app calls `verifyPayment`; Pro flips on within a second or two (the
   webhook is a backup). Check `entitlements/{your-uid}` in Firestore.
4. When happy, swap **test** keys for **live** keys in `billing-config.js`
   (public) and `functions:secrets:set` (secret), and redeploy.

---

## How it works
- **Checkout** runs in the browser (Flutterwave inline). On success the app
  calls the **`verifyPayment`** callable, which re-checks the transaction with
  Flutterwave's API using the secret key and then writes `entitlements/{uid}`
  with `proUntil = now + PRO_DAYS`.
- **`flwWebhook`** does the same server-to-server as a reliability backup
  (validated by the `verif-hash` header).
- The app subscribes to `entitlements/{uid}` and unlocks Pro features when
  `pro === true` and `proUntil` is in the future.

## Notes
- This is a **one-off payment per period** (renew by paying again) — simplest
  and works with mobile money. Recurring card billing can be added later via
  Flutterwave Payment Plans.
- Pro is tied to the **account**, so it follows the farmer across devices.
- To revert to evaluation mode, set `flwPublicKey` back to `"REPLACE_ME"`.
