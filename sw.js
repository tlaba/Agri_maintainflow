/* MaintainFlow Ag — service worker (offline-first) */
var VERSION = 'mfag-v1.7.0';
var CORE = [
  './',
  './index.html',
  './css/styles.css',
  './js/app.js',
  './js/firebase-config.js',
  './js/billing-config.js',
  './js/analytics-config.js',
  './agriservices.json',
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
  if (/(\.|^)(googleapis\.com|firebaseio\.com|firebaseapp\.com|google\.com|open-meteo\.com)$/.test(url.hostname)) return;

  if (url.origin === location.origin) {
    // App shell (HTML / JS / CSS): network-first so a new deploy shows up on the
    // next reload when online; fall back to cache (and the shell) when offline.
    var isShell = req.mode === 'navigate' || req.destination === 'script' || req.destination === 'style' ||
      url.pathname === '/' || /\.(html|js|css)$/.test(url.pathname);
    if (isShell) {
      e.respondWith(
        fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
          return res;
        }).catch(function () {
          return caches.match(req).then(function (cached) {
            return cached || (req.mode === 'navigate' ? caches.match('./index.html') : undefined);
          });
        })
      );
      return;
    }
    // Static assets (icons, json, manifest): cache-first, then network.
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copy); }).catch(function () {});
          return res;
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
