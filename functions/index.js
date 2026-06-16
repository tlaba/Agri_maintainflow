/* MaintainFlow Ag — Cloud Functions (Flutterwave billing)
 *
 * Two entry points:
 *   verifyPayment (callable) — the app calls this right after a successful
 *     Flutterwave checkout; we verify the transaction server-side and grant Pro.
 *   flwWebhook (HTTPS)       — Flutterwave calls this on charge.completed as a
 *     reliable backup; we verify and grant Pro.
 *
 * Pro is stored at entitlements/{uid} which the client can READ but NOT WRITE
 * (see firestore.rules), so Pro is enforceable.
 *
 * Secrets (set with `firebase functions:secrets:set`):
 *   FLW_SECRET_KEY    — Flutterwave secret key (server only, never in the app)
 *   FLW_WEBHOOK_HASH  — the "Secret hash" you set in the Flutterwave dashboard
 * Params (optional, defaults shown):
 *   PRO_PRICE=49  PRO_CURRENCY=BWP
 */
const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

const FLW_SECRET = defineSecret('FLW_SECRET_KEY');
const FLW_HASH = defineSecret('FLW_WEBHOOK_HASH');
const PRO_PRICE = defineString('PRO_PRICE', { default: '49' });
const PRO_CURRENCY = defineString('PRO_CURRENCY', { default: 'BWP' });
const PRO_DAYS = 30;

async function grantPro(uid, txId) {
  const ref = db.collection('entitlements').doc(String(uid));
  const snap = await ref.get();
  const now = Date.now();
  const current = snap.exists && snap.data().proUntil && snap.data().proUntil > now ? snap.data().proUntil : now;
  const proUntil = current + PRO_DAYS * 24 * 60 * 60 * 1000;
  await ref.set({ pro: true, plan: 'pro-monthly', proUntil: proUntil, lastTx: txId || null, updatedAt: now }, { merge: true });
  return proUntil;
}

async function flwVerify(transactionId, secret) {
  const res = await fetch('https://api.flutterwave.com/v3/transactions/' + encodeURIComponent(transactionId) + '/verify', {
    headers: { Authorization: 'Bearer ' + secret }
  });
  return res.json();
}

function paymentOk(json) {
  const d = json && json.data;
  return !!(json && json.status === 'success' && d && d.status === 'successful' &&
    Number(d.amount) >= Number(PRO_PRICE.value()) && String(d.currency) === String(PRO_CURRENCY.value()));
}

// Called by the app immediately after checkout. Trusts the authenticated uid.
exports.verifyPayment = onCall({ secrets: [FLW_SECRET], cors: true }, async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const txId = req.data && (req.data.transaction_id || req.data.transactionId);
  if (!txId) throw new HttpsError('invalid-argument', 'transaction_id is required.');
  const json = await flwVerify(txId, FLW_SECRET.value());
  if (!paymentOk(json)) throw new HttpsError('failed-precondition', 'Payment could not be verified.');
  const proUntil = await grantPro(req.auth.uid, txId);
  return { pro: true, proUntil: proUntil };
});

// Flutterwave server-to-server webhook (reliable backup). uid travels in meta.
exports.flwWebhook = onRequest({ secrets: [FLW_SECRET, FLW_HASH] }, async (request, response) => {
  const sig = request.headers['verif-hash'];
  if (!sig || sig !== FLW_HASH.value()) { response.status(401).send('invalid signature'); return; }
  try {
    const ev = request.body || {};
    const data = ev.data || {};
    if ((ev.event === 'charge.completed' || ev.type === 'charge.completed') && data.status === 'successful' && data.id) {
      const json = await flwVerify(data.id, FLW_SECRET.value());
      const d = json && json.data;
      const uid = (d && d.meta && (d.meta.uid || d.meta.consumer_id)) || (data.meta && data.meta.uid);
      if (uid && paymentOk(json)) await grantPro(uid, d.id);
    }
    response.status(200).send('ok');
  } catch (e) {
    console.error('flwWebhook error', e);
    response.status(200).send('ok'); // ack so Flutterwave doesn't retry-storm; check logs
  }
});
