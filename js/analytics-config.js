/* MaintainFlow Ag — analytics configuration (Umami Cloud).
   Tracking is offline-queued (events buffer in localStorage and flush when
   online) and gated behind the in-app consent — see js/app.js + docs/ANALYTICS.md.
   Leave both blank to disable analytics entirely. */
window.MFAG_ANALYTICS = {
  host: 'https://cloud.umami.is',
  websiteId: '4702bdc4-6f94-44a5-8fb7-9a20275e03e3'
};
