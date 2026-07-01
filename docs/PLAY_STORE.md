# Google Play submission pack — MaintainFlow Ag

Ship the PWA to Google Play as a **TWA** (Trusted Web Activity) — a thin wrapper
around `https://agri.maintainflow.pro`. One codebase, instant updates (deploy to
Netlify as usual; no store re-review for content), offline-first preserved.

- **Package name:** `pro.maintainflow.agri`
- **App URL:** `https://agri.maintainflow.pro`
- **Privacy policy URL:** `https://agri.maintainflow.pro/privacy.html`
- **Assets:** [`docs/marketing/playstore/`](marketing/playstore) (icon, feature graphic, 6 screenshots)

---

## Step-by-step (≈30–45 min + Google's review)

1. **Create a Google Play Console account** — one-time **US$25** at
   <https://play.google.com/console> (needs your ID + payment).
2. **Generate the Android package** at **PWABuilder**:
   - Go to <https://www.pwabuilder.com>, enter `https://agri.maintainflow.pro`.
   - **Package for stores → Android**. Set **Package ID** = `pro.maintainflow.agri`,
     App name = `MaintainFlow Ag`, Launcher name = `MaintainFlow`. Leave "Signing key
     = new" (or use Play App Signing). Download the **.aab** (and the generated
     `assetlinks.json` snippet — keep it).
3. **Create the app in Play Console** → upload the **.aab** to the **Internal testing**
   track first (fastest), then Production.
4. **Get your signing SHA-256 fingerprint:**
   - Play Console → your app → **Test and release → App integrity → Play app signing**
     → copy the **SHA-256 certificate fingerprint**.
5. **Wire up domain verification:** open `.well-known/assetlinks.json` in this repo,
   replace `REPLACE_WITH_SHA256_FROM_PLAY_CONSOLE` with that SHA-256 (PWABuilder's
   generated snippet already has the right value — you can paste the whole array),
   commit → it deploys automatically. Verify it's live & valid:
   `https://agri.maintainflow.pro/.well-known/assetlinks.json`
   (Google's checker: <https://developers.google.com/digital-asset-links/tools/generator>)
6. **Fill the store listing** with the copy below + upload the assets.
7. **Complete the Data safety form** using the answers below.
8. **Set the privacy policy URL:** `https://agri.maintainflow.pro/privacy.html`
9. **Submit for review** (usually a few days).

> Tip: start on **Internal testing** to confirm the TWA opens full-screen and verifies
> the domain (no browser address bar). If you still see the URL bar, the assetlinks
> fingerprint doesn't match yet — recheck step 5.

---

## Store listing copy

**App name (≤30):**
`MaintainFlow Ag: Farm Manager`

**Short description (≤80):**
`Track crops, livestock, costs & tasks — works offline. For African farmers.`

**Full description (≤4000):**
```
Run your whole farm from your pocket. MaintainFlow Ag is a simple, offline-first
farm management app built for African smallholder and emerging farmers — crops AND
livestock, in one place.

No notebooks. No lost records. No signal needed.

🌱 CROPS
• Track every field: crop, variety, size, planting date
• Work orders & reminders for spraying, fertilizing and irrigation
• Safe spray re-entry windows
• Weather & frost alerts for your farm

🐄 LIVESTOCK
• Manage herds of cattle, goats, sheep, poultry & pigs
• Health & vaccination reminders
• Weights, growth, births, deaths & sales
• Milk & egg production

🗓️ ONE SCHEDULE
• Every job — field tasks, livestock health and equipment service — on one timeline
• Colour-coded Overdue / This week / Later, ticked off with one tap

💰 MONEY
• Log every expense and see your cost per hectare
• Understand where your money goes
• Local market prices

🤝 AGRI SERVICES
• Find markets & buyers, funding & support, vets and extension advice in YOUR country
• Programmes & boards for Botswana, South Africa, Zambia, Zimbabwe, Namibia, Kenya,
  Nigeria, Ghana and more

🏦 GET FINANCE-READY (Pro)
• Turn your records into a credit-readiness report lenders and co-ops accept
• Yield & herd analytics across your seasons

📴 BUILT FOR HOW AFRICA FARMS
• Works fully offline — everything saves on your phone and syncs when you're back online
• Light on data and battery
• Free to start

Whether you grow maize, keep cattle, or both — MaintainFlow helps you farm like a
business: cut costs, remember every job, and build records that unlock finance.

Farm management for African growers. 🌍
```

**Category:** Business _(or)_ Productivity
**Tags/keywords to weave in:** farm management, farming app, livestock, crops, record
keeping, agriculture, offline, expenses, smallholder, cattle, agri.
**Contact email:** `info@maintainflow.pro`

---

## Data safety form answers

- **Does your app collect or share user data?** Yes (collect). **Not sold.**
- **Is data encrypted in transit?** Yes.
- **Can users request deletion?** Yes — in-app: More → account → Delete account.

Declare these data types (all: purpose = *App functionality*; optional; not shared for
ads; not sold):

| Data type | Collected? | Notes |
|-----------|-----------|-------|
| Email address / Phone number | Yes (optional) | Only if the user creates an account to back up/sync (Firebase Auth). |
| Approximate location | Yes (optional) | Only if the user taps "use my location" for local weather. |
| Financial info — purchase history | Yes (optional) | Pro purchases via Stripe (Stripe handles card data; we don't store it). |
| App activity / analytics | Yes (optional) | Anonymous, cookieless usage events (Umami), only with consent. |
| App info & performance | Yes | Basic crash/diagnostic behaviour. |

- User-entered farm records (fields, herds, costs) are **stored on the device** and, if
  the user signs in, in their private Firebase account — not shared with third parties
  beyond the storage provider.
- **Third parties (service providers):** Google Firebase (auth + storage), Stripe
  (payments), Umami (anonymous analytics).

---

## Asset checklist (all included in `docs/marketing/playstore/`)

| Play requirement | File | Spec |
|------------------|------|------|
| App icon | `app-icon-512.png` | 512×512 PNG ✅ |
| Feature graphic | `feature-graphic-1024x500.png` | 1024×500 PNG ✅ |
| Phone screenshots (2–8) | `screenshot-01..06.png` | 1080×1920 PNG ✅ |
| Privacy policy | `/privacy.html` (live) | public URL ✅ |
| Domain verification | `/.well-known/assetlinks.json` (live) | add SHA-256 in step 5 |

_Optional later: a promo/hero video (we have the 16:9 reel), and a tablet screenshot set._
