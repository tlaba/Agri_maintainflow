/* ===================================================================
   Stripe billing config for MaintainFlow Ag (Canada-based merchant).

   Stripe Checkout runs server-side: the app calls the `createCheckoutSession`
   Cloud Function, which creates a hosted Checkout session and returns its URL;
   the app redirects there. No Stripe.js or publishable key is needed in the
   browser — the only Stripe key that exists is the SECRET key, which lives in
   the Cloud Function's secrets, never here.

   The price (amount / currency / days) is defined server-side by the Cloud
   Function params (PRO_PRICE_CENTS / PRO_CURRENCY / PRO_DAYS) so it can't be
   tampered with. `displayPrice` below is ONLY the button label — keep it in
   sync with the server amount.

   Until you set `enabled: true` (after deploying the function), the app falls
   back to the local "Activate Pro (evaluation)" toggle, so nothing breaks.
   See BILLING-SETUP.md.
   =================================================================== */
window.MFAG_BILLING = {
  provider: "stripe",
  enabled: true,                      // billing is live (Cloud Function deployed)
  displayPrice: "US$4.99 / 30 days",  // button label only; real amount lives server-side
  // Default callable region is us-central1; set if you deployed elsewhere.
  functionsRegion: "us-central1"
};
