/* MaintainFlow Ag — service worker (offline-first) */
var VERSION = 'mfag-v1.0.8';
var CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/firebase-config.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png'
];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(CORE); }).catch(function () {}));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);

  // Never intercept Firebase Auth / Firestore traffic — let it reach the network
  // (Firestore handles its own offline persistence). The Firebase SDK itself is
  // served from gstatic.com and is cached by the cross-origin handler below.
  if (/(\.|^)(googleapis\.com|firebaseio\.com|firebaseapp\.com|google\.com)$/.test(url.hostname)) return;

  // App shell & same-origin: cache-first, fall back to network, then cache the response.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
          return res;
        }).catch(function () {
          // navigation fallback to app shell when offline
          if (req.mode === 'navigate') return caches.match('./index.html');
        });
      })
    );
    return;
  }

  // Cross-origin (e.g. Google Fonts): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then(function (cached) {
      var net = fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
        return res;
      }).catch(function () { return cached; });
      return cached || net;
    })
  );
});
