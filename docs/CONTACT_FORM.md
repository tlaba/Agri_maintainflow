# Contact form

How the in-app **Contact us** form works, how to operate it, and how to test it.

Live location in the app: **More → Support → Contact us** (also reachable from
More → Settings → Version).

---

## What it does

A farmer picks a **topic**, enters their **email**, and writes a **message**.
On send it submits to a **Netlify Forms** backend, so messages land in the
Netlify dashboard and (once configured) trigger an email to
**info@maintainflow.pro** — no server code of our own.

Because the app is an offline-first PWA, the form **degrades gracefully**: if the
network request fails (offline, or Forms not yet enabled), it falls back to a
`mailto:info@maintainflow.pro` so the message is never lost. A manual
"email us" link with a copy-to-clipboard button is always shown as well.

### Topics
`Bug report`, `Feature request`, `Billing & Pro`, `Account & login`,
`Partnership / sales`, `Something else`.

---

## How it's wired (for developers)

Netlify's deploy bot only detects forms present in **static HTML** at build time.
Our form is rendered by JavaScript, so we use the standard SPA pattern:

1. **Detection stub** — a hidden static form in `index.html` registers the form
   name and its fields with Netlify on every deploy. Do not remove it.

   ```html
   <form name="contact" data-netlify="true" netlify-honeypot="bot-field" hidden>
     <input type="hidden" name="form-name" value="contact" />
     <input type="text" name="bot-field" />   <!-- spam honeypot -->
     <input type="text" name="topic" />
     <input type="email" name="email" />
     <textarea name="message"></textarea>
     <input type="text" name="context" />      <!-- app version · region · plan -->
   </form>
   ```

   > Use `data-netlify="true"` (not the bare `netlify` attribute) plus an
   > explicit `form-name` hidden input — this is what reliably gets the form
   > **registered** by Netlify's deploy scan. If `POST /` returns 404, the form
   > isn't registered: confirm form detection is on and redeploy so it re-scans.

2. **Live form + submit** — `openContactSheet()` in `js/app.js` renders the real
   form and submits via `fetch`:

   ```js
   fetch('/', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: formEncode({ 'form-name': 'contact', 'bot-field': '', topic, email, message, context })
   })
   ```

   - `form-name` **must** equal the static form's `name` (`contact`).
   - On a non-OK response or a thrown error, it calls `mailtoFallback()`.
   - `context` carries `v<APP_VERSION> · <region> · <plan>` to help triage.

### Validation
- Message is required.
- Email must match a basic `x@y.z` pattern (so we can reply). When the user is
  signed in to the cloud account, the email field is pre-filled.

### Spam protection
The `bot-field` honeypot is submitted empty by humans; bots that fill it are
dropped by Netlify.

---

## One-time Netlify dashboard setup ⚠️

Two steps that **cannot** be done from code:

1. **Enable form detection.** Site → **Forms**. After a deploy that includes the
   hidden stub, a **`contact`** form appears in the list. If it doesn't, turn on
   *Form detection* in the Forms settings and redeploy.

2. **Add an email notification.** Forms → **Settings & notifications** →
   **Add notification → Email notification** → send to **info@maintainflow.pro**.
   Without this, submissions only accumulate in the dashboard with no alert.

Free tier covers **100 submissions/month**.

---

## Testing

1. Open the live app and reload until you're on the latest version
   (see the version label in More → Settings).
2. Send a test message from **More → Support → Contact us**.
3. Confirm it appears under **Netlify → Forms → contact**.
4. Confirm the email arrives at **info@maintainflow.pro** (after step 2 of setup).

Offline check: turn off the network and submit — the OS mail composer should
open, pre-addressed with the topic as the subject.

---

## Possible follow-ups

- **Auto-reply to the sender** — Netlify Forms alone won't do this. It needs a
  small Netlify Function triggered on submission, or a service like Formspree.
- **In-app inbox** — would require moving the backend to Firestore + a small
  admin view; only worth it if volume grows beyond the Netlify dashboard.
