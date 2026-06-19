/* MaintainFlow Ag — analytics configuration (Umami, self-hosted).
   1. Stand up Umami (https://umami.is), add a website for your app domain.
   2. Paste the Umami host URL and the website's ID below.
   Leave blank to disable analytics — events still queue locally (capped) and
   nothing is ever sent. Tracking is also gated behind the in-app consent. */
window.MFAG_ANALYTICS = {
  host: '',        // e.g. 'https://analytics.yourdomain.com'  (no trailing slash needed)
  websiteId: ''    // e.g. '00000000-0000-0000-0000-000000000000'
};
