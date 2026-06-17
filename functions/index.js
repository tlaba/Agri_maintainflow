/* MaintainFlow Ag — Cloud Functions (Stripe billing, Canada-based merchant)
 *
 * Two entry points:
 *   createCheckoutSession (callable) — the app calls this; we create a hosted
 *     Stripe Checkout session for the signed-in user and return its URL. The
 *     app redirects the browser there.
 *   stripeWebhook (HTTPS)            — Stripe calls this on completed payments;
 *     we verify the signature, then grant Pro. This is the source of truth.
 *
 * Pro is stored at entitlements/{uid} which the client can READ but NOT WRITE
 * (see firestore.rules), so Pro is enforceable.
 *
 * Secrets (set with `firebase functions:secrets:set`):
 *   STRIPE_SECRET_KEY      — Stripe secret key (server only, never in the app)
 *   STRIPE_WEBHOOK_SECRET  — the signing secret from the Stripe webhook endpoint
 * Params (optional, defaults shown):
 *   PRO_PRICE_CENTS=499  PRO_CURRENCY=usd   (amount charged per period)
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineInt, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const Stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const STRIPE_SECRET = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');
const PRO_PRICE_CENTS = defineInt('PRO_PRICE_CENTS', { default: 499 });
const PRO_CURRENCY = defineString('PRO_CURRENCY', { default: 'usd' });
const PRO_DAYS = 30;
const PRO_NAME = 'MaintainFlow Pro';

function stripeClient() { return Stripe(STRIPE_SECRET.value()); }

// Grant (or extend) Pro by PRO_DAYS from now or from the current expiry.
async function grantPro(uid, ref) {
  const eref = db.collection('entitlements').doc(String(uid));
  const snap = await eref.get();
  const now = Date.now();
  const current = snap.exists && snap.data().proUntil && snap.data().proUntil > now ? snap.data().proUntil : now;
  const proUntil = current + PRO_DAYS * 24 * 60 * 60 * 1000;
  await eref.set({ pro: true, plan: 'pro-monthly', proUntil: proUntil, lastTx: ref || null, updatedAt: now }, { merge: true });
  return proUntil;
}

// Called by the app. Creates a hosted Checkout session tied to the auth'd uid.
exports.createCheckoutSession = onCall({ secrets: [STRIPE_SECRET], cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const uid = req.auth.uid;
  const origin = (req.data && req.data.origin) || '';
  if (!/^https?:\/\//.test(origin)) throw new HttpsError('invalid-argument', 'A valid origin is required.');
  const stripe = stripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{
      quantity: 1,
      price_data: {
        currency: PRO_CURRENCY.value(),
        unit_amount: PRO_PRICE_CENTS.value(),
        product_data: { name: PRO_NAME, description: PRO_DAYS + ' days of Pro' }
      }
    }],
    client_reference_id: uid,
    metadata: { uid: uid },
    success_url: origin + '/?pro=1',
    cancel_url: origin + '/?pro=cancel'
  });
  return { url: session.url };
});

// Stripe server-to-server webhook (source of truth). Signature-verified.
exports.stripeWebhook = onRequest({ secrets: [STRIPE_SECRET, STRIPE_WEBHOOK_SECRET] }, async (request, response) => {
  const stripe = stripeClient();
  let event;
  try {
    event = stripe.webhooks.constructEvent(
      request.rawBody, request.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value()
    );
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    response.status(400).send('invalid signature');
    return;
  }
  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const uid = s.client_reference_id || (s.metadata && s.metadata.uid);
      if (uid && (s.payment_status === 'paid' || s.status === 'complete')) {
        await grantPro(uid, s.payment_intent || s.id);
      }
    }
    response.status(200).send('ok');
  } catch (e) {
    console.error('stripeWebhook error', e);
    response.status(200).send('ok'); // ack so Stripe doesn't retry-storm; check logs
  }
});
