/* ===================================================================
   Firebase web config for MaintainFlow Ag.

   These values are NOT secrets — Firebase web config keys are meant to
   ship in the browser. Your data is protected by Firestore Security
   Rules (see firestore.rules), not by hiding these keys.

   NOTE: this app loads as a plain <script> (no bundler), so the config
   is exposed as a global object below — NOT via `import ... from
   "firebase/app"`. The Firebase SDK itself is lazy-loaded by js/app.js.
   See FIREBASE-SETUP.md for the full walkthrough.
   =================================================================== */
window.MFAG_FIREBASE = {
  apiKey: "AIzaSyD1idj0SOCw-7_REUcHw9fI5qfJTq4OfgY",
  authDomain: "maintainflow-ag.firebaseapp.com",
  projectId: "maintainflow-ag",
  storageBucket: "maintainflow-ag.firebasestorage.app",
  messagingSenderId: "411612647029",
  appId: "1:411612647029:web:c425953e14364dea4eb23c",
  measurementId: "G-4YT29N2Z9L"
};
