# MaintainFlow Ag — Deploy to `agri.maintainflow.pro`

A static, offline-first PWA. No build step, no server. Just upload the files and point a subdomain at them.

## What's in here
```
index.html              app shell (all screens)
css/styles.css          styling (mobile-first, Android-optimized)
js/app.js               app logic + offline storage + install prompt
sw.js                   service worker (works offline)
manifest.webmanifest    PWA manifest (icons, name, theme)
icons/                  app icons (192, 512, maskable, apple-touch)
netlify.toml            caching headers + SPA fallback (used automatically)
```
Data is stored on the device (localStorage), so the app works with no signal. Nothing is sent to a server in this version.

---

## Step 1 — Put it on Netlify

**Option A — Drag & drop (fastest, ~2 min)**
1. Go to https://app.netlify.com/drop
2. Drag this whole folder onto the page.
3. Netlify gives you a live URL like `https://random-name-1234.netlify.app`. Open it on an Android phone to test.

**Option B — Git (best for updates)**
1. Push this folder to a GitHub repo.
2. In Netlify: **Add new site → Import an existing project → GitHub → pick the repo.**
3. Build command: *leave blank.* Publish directory: `.` (a dot). Deploy.
   - Every `git push` redeploys automatically.

---

## Step 2 — Point `agri.maintainflow.pro` at it

In Netlify: **Site → Domain management → Add a domain → `agri.maintainflow.pro` → Verify.**
Netlify will tell you to add **one DNS record** at whoever manages `maintainflow.pro` (your registrar or DNS host):

| Type  | Name / Host | Value (target)                       |
|-------|-------------|--------------------------------------|
| CNAME | `agri`      | `your-site-name.netlify.app`         |

- Add that CNAME in your DNS provider's dashboard, save, and wait for it to propagate (usually minutes, up to an hour).
- Back in Netlify, the domain flips to **"Netlify DNS / verified"** and HTTPS is issued automatically (free Let's Encrypt). **Do not skip HTTPS — a PWA service worker only runs over HTTPS.**

> If `maintainflow.pro` already uses **Netlify DNS**, it's even simpler: Netlify adds the `agri` record for you when you add the domain.

---

## Step 3 — Confirm it's a real installable app
On an Android phone (Chrome):
1. Open `https://agri.maintainflow.pro`.
2. You should see the teal **"Add to home screen"** banner near the bottom — tap **Install**.
3. Confirm the icon lands on the home screen and opens full-screen (no browser bar).
4. Turn on airplane mode and reopen it — it should still load and your data should still be there.

To verify the PWA is healthy: Chrome DevTools → **Lighthouse → Analyze → Progressive Web App**, or **Application → Manifest / Service Workers**.

---

## Shipping updates later
Because the app is offline-cached, bump the version when you change files so users get the update:
- In `sw.js`, change `VERSION = 'mfag-v1.0.0'` to `v1.0.1`, etc. The old cache is cleared automatically on next visit.

## Where to take it next
- **Cloud sync / multi-device:** add Firebase or Supabase and sync the local data when online (the data model in `app.js` is plain JSON, so this is straightforward).
- **Play Store listing:** wrap this URL as a Trusted Web Activity with PWABuilder (https://pwabuilder.com) — one-time $25 Google Play fee.
- **Live market prices / weather:** replace the sample data in `viewMoney()` and the frost banner with a real API call (cache the last result for offline).
