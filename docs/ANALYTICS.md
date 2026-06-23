# Analytics & funnel tracking

How MaintainFlow Ag measures the marketing funnel (installs → activation →
weekly active → Pro). Three sources, by design:

1. **Umami** (client events) — top-of-funnel, installs, source/UTM, anonymous usage.
2. **Firestore** (your synced data) — activation, weekly active, retention, Pro cohort.
3. **Stripe** — revenue and Pro conversions.

---

## 1. Setup (Umami)

1. Stand up Umami (self-hosted, free — https://umami.is) and add a website.
2. Put the host URL + website ID in **`js/analytics-config.js`**:
   ```js
   window.MFAG_ANALYTICS = { host: 'https://analytics.yourdomain.com', websiteId: '…' };
   ```
3. Deploy. That's it.

**Privacy & offline by design:**
- Sends **nothing** until configured **and** the user accepts the in-app consent.
- Cookieless; no PII. Events **queue in `localStorage`** and flush when online,
  so offline-first usage is still counted (queue capped at 300).
- If unconfigured, events queue locally and are never sent (zero cost).

## 2. Events emitted (custom)

| Event | Fires when | Use it for |
|-------|-----------|------------|
| `launch` | App start (`{standalone, mode}`) | Visits; **iOS install proxy** via `standalone:true` |
| _pageview_ | Each screen change (`go()`) | Active screens, navigation |
| `install_prompt` | Android/desktop prompt answered (`{outcome}`) | Prompt accept/dismiss rate |
| `app_installed` | Browser `appinstalled` fires | **Installs** (Android/desktop) |
| `consent_granted` | User accepts consent | Consent rate |
| `activated` | User creates ≥3 of their own items | **Activation** (seed excluded) |
| `pro_checkout_start` | Taps "Get Pro" (Stripe) | Checkout intent |
| `pro_activated` | Pro turned on (`{via}`) | **Free→Pro** |

Every event carries `data.src` = the captured **UTM** (e.g. `flyer/qr`,
`whatsapp`), so installs/activations are attributable to channel.

### Reading installs in Umami
- **Android/desktop:** count `app_installed` (and `install_prompt outcome=accepted`).
- **iOS:** no install event exists on iOS — use `launch` with `standalone=true`
  (a standalone launch = the app was added to the home screen).

## 3. UTM scheme (tie to the content calendar)

Append to every link / the flyer QR so installs map to a channel:

```
?utm_source=flyer&utm_medium=qr
?utm_source=whatsapp
?utm_source=facebook&utm_medium=reel&utm_campaign=livestock
?utm_source=radio
?utm_source=referral
```
Captured on first load and persisted, then attached to all events.

## 4. Firestore-derived metrics (signed-in farms)

The whole farm DB syncs to Firestore, and `save()` stamps two fields in
`settings`:

- `createdAt` (ms, set once) — for cohorts / first-seen.
- `lastActiveISO` (`YYYY-MM-DD`, each save) — for active/retention.

Plus `settings.activated`, `settings.plan`, and counts of `fields` / `herds` /
`tasks` / `expenses` / `yields`. From these you can compute, with simple
queries (or a scheduled Cloud Function writing to a `metrics` collection):

- **Weekly Active Farms** — docs with `lastActiveISO` within 7 days.
- **Activation rate** — `activated == true` ÷ total.
- **Retention** — `lastActiveISO` vs `createdAt` by weekly cohort.
- **Pro cohort** — `plan == 'pro'`.

> Guests (never signed in) are local-only by design — they're covered by Umami,
> not Firestore. That split is intentional (privacy + offline).

## 5. Money

Use the **Stripe dashboard** for revenue, active subscriptions and churn — it's
the source of truth. Correlate with `pro_activated` / `pro_checkout_start`.

---

### KPI → where to look (quick map)
| KPI | Source |
|-----|--------|
| Installs | Umami `app_installed` + `launch{standalone}` (iOS) |
| Source/attribution | Umami UTM on all events |
| Activation | Umami `activated` **or** Firestore `activated` |
| Weekly Active Farms | Umami visits **or** Firestore `lastActiveISO` |
| Free→Pro | Umami `pro_activated` + Stripe |
| Retention | Firestore cohorts (`createdAt` vs `lastActiveISO`) |
| Revenue | Stripe |
