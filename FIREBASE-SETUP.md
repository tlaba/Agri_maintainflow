# Turn on cloud accounts (Firebase) for MaintainFlow Ag

The app works offline with no login by default. Follow these steps to enable
**email/password accounts with cloud sync across devices**. It's free on
Firebase's Spark plan for this scale.

You only edit one file in the repo: `js/firebase-config.js`.

---

## 1. Create a Firebase project
1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. **Add project** → name it (e.g. `maintainflow-ag`) → you can disable Google
   Analytics → **Create project**.

## 2. Enable Email/Password sign-in
1. Left menu → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Email/Password** → toggle **Enable** → **Save**.

## 3. Create the Firestore database
1. Left menu → **Build → Firestore Database → Create database**.
2. Choose a location close to your users → start in **Production mode** → **Enable**.

## 4. Add the security rules
1. Firestore → **Rules** tab.
2. Replace everything with the contents of [`firestore.rules`](./firestore.rules)
   in this repo → **Publish**.
   - These rules let each user read/write only their own data and deny everyone else.

## 5. Register a Web app and copy the config
1. Project **Settings** (gear icon, top-left) → **General** → scroll to **Your apps**.
2. Click the **Web** icon (`</>`) → give it a nickname → **Register app**.
   (You do **not** need Firebase Hosting — we deploy on Netlify.)
3. Firebase shows a `firebaseConfig` object. Copy its values into
   **`js/firebase-config.js`**, replacing every `REPLACE_ME`:

```js
window.MFAG_FIREBASE = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123"
};
```

> These web keys are **not secrets** — they're meant to ship in the browser.
> Your data is protected by the security rules from step 4, not by hiding them.

## 6. Authorize your domain
Firebase → **Authentication → Settings → Authorized domains** → make sure
`agri.maintainflow.pro` (and `localhost` for testing) are listed. Add the
domain if it isn't there, or sign-in will be blocked.

## 7. Deploy
Commit the edited `js/firebase-config.js` and push. Once it's live:
- The app shows a **Sign in / Create account** screen.
- After the first online sign-in, it works offline and syncs when back online.
- Existing on-device data is migrated into your account on first sign-in.

---

## How it behaves
- **Offline-first preserved:** Firebase Auth keeps you signed in offline, and
  Firestore caches your data on the device, syncing when a connection returns.
- **One document per user:** all your farm data lives at `users/{your-uid}`.
- **Free tier limits** (Spark) are far above a single farm's usage.

## Notes / options
- **Phone-number (SMS) login** is possible but needs the pay-as-you-go Blaze
  plan (SMS costs money). Email/password is free — start there.
- To go back to local-only mode, set `apiKey` back to `"REPLACE_ME"`.
