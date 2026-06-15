/* ===================================================================
   Firebase web config for MaintainFlow Ag.

   These values are NOT secrets — Firebase web config keys are meant to
   ship in the browser. Your data is protected by Firestore Security
   Rules (see firestore.rules), not by hiding these keys.

   HOW TO FILL THIS IN  (see FIREBASE-SETUP.md for the full walkthrough):
     1. Firebase Console -> create a project (free "Spark" plan is fine).
     2. Build -> Authentication -> Sign-in method -> enable Email/Password.
     3. Build -> Firestore Database -> Create database (production mode).
     4. Project settings (gear) -> "Your apps" -> Web app (</>) -> register.
     5. Copy the firebaseConfig values into the object below.
     6. Paste the contents of firestore.rules into Firestore -> Rules -> Publish.

   Until apiKey is filled in, the app runs in LOCAL mode (no login, data
   stays on the device) exactly as before — so nothing breaks meanwhile.
   =================================================================== */
window.MFAG_FIREBASE = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.appspot.com",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME"
};
