# DEPLOY — activate the community & moderation features

⚠️ **The app is live, but the community Agri-services directory + moderation
do NOT work until you run the Firebase deploy below.** Until then the curated
directory keeps working; listings, reports, the public mirror, auto-hide and
the admin view are all inert.

## One command activates everything
```bash
firebase deploy --only firestore:rules,functions
```
This ships:
- **firestore.rules** — listings, reports, public mirror, admins access.
- **functions** — `onListingWritten` (public mirror for guests) and
  `onReportCreated` (auto-hide after 3 reports).

> First time only, the functions need their deps: `cd functions && npm install`
> (Cloud Functions also requires the Blaze plan.)

## Make yourself a moderator (one-time)
1. Firebase console → **Authentication → Users** → copy your **User UID**.
2. Firebase console → **Firestore** → create a document **`admins/<your-uid>`**
   (any field, e.g. `role: "owner"`).
3. Sign in on the app → **More → Support → 🛡️ Moderation** appears.

## Verify live (after deploy)
- [ ] Publish a listing from a Pro account.
- [ ] Open the app in **incognito/guest** in the same country → the listing shows
      (public mirror works).
- [ ] Report a listing from 3 different accounts → it disappears (auto-hide works).
- [ ] Open **Moderation** → reported listings appear with Hide / Delete / Dismiss.

## Tuning
- Report auto-hide threshold: `REPORT_THRESHOLD` in `functions/index.js` (default 3).

---
_Status: ⬜ not deployed yet — delete this file once done._
