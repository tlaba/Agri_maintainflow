/* ===================================================================
   Flutterwave billing config for MaintainFlow Ag.

   flwPublicKey is the PUBLIC key (safe to ship in the browser). The SECRET
   key NEVER goes here — it lives in the Cloud Function's secrets.

   Until flwPublicKey is filled in, the app falls back to the local
   "Activate Pro (evaluation)" toggle, so nothing breaks before billing is
   set up. See BILLING-SETUP.md.

   priceBWP / currency / days MUST match PRO_PRICE / PRO_CURRENCY / PRO_DAYS
   used by the Cloud Function, or verification will reject the payment.
   =================================================================== */
window.MFAG_BILLING = {
  flwPublicKey: "REPLACE_ME",        // e.g. "FLWPUBK-xxxxxxxxxxxxxxxxxxxxxxxx-X"
  priceBWP: 49,                       // price per Pro period
  currency: "BWP",                    // Botswana Pula
  days: 30,                           // Pro access granted per payment
  // Default callable region is us-central1; set if you deployed elsewhere.
  functionsRegion: "us-central1"
};
