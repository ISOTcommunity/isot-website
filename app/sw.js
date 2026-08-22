/* ISOT app service worker.
 *
 * Two jobs:
 *   1. Android/Chrome only offers "Install app" if a service worker is registered.
 *   2. Offline shell — a member can open their card and show today's QR in a basement
 *      bar with no signal. This is why the QR is a daily code rather than a 90-second
 *      one: a short-lived token is useless exactly where it is needed.
 *
 * Supabase calls are never cached — stale membership status must not be shown to a
 * bartender as valid.
 */

const CACHE = 'isot-shell-v1';

const SHELL = [
  './',
  'index.html',
  'home.html',
  'login.html',
  'signup.html',
  'profile.html',
  'css/app.css',
  'js/isot.js',
  'vendor/supabase.js',
  'vendor/qrcode.min.js',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    // addAll is all-or-nothing; a single 404 during development would break install,
    // so cache each entry independently and tolerate misses.
    caches.open(CACHE).then((c) => Promise.allSettled(SHELL.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never cache the API. A cached "you are a member" could be served to a bar after
  // the membership lapsed.
  if (url.hostname.endsWith('.supabase.co')) return;

  if (e.request.method !== 'GET') return;

  // Cache-first for our own shell, with a background refresh so updates land next visit.
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then((hit) => {
        const live = fetch(e.request)
          .then((res) => {
            if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
            return res;
          })
          .catch(() => hit);
        return hit || live;
      })
    );
  }
});
