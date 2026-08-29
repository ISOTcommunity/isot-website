/* ISOT App Service Worker
 * Offline Shell v3 — Supports all member, volunteer, board & partner screens.
 * Supabase calls are NEVER cached to ensure real-time RLS security.
 */

const CACHE = 'isot-shell-v9';

const SHELL = [
  './',
  'index.html',
  'home.html',
  'login.html',
  'signup.html',
  'profile.html',
  'complete-profile.html',
  'reset.html',
  'forgot.html',
  'scan.html',
  'karaoke.html',
  'karaoke-kj.html',
  'checkin.html',
  'dashboard.html',
  'admin.html',
  'assembly.html',
  'partner.html',
  'css/app.css',
  'js/isot.js',
  'vendor/supabase.js',
  'vendor/qrcode.min.js',
  'vendor/html5-qrcode.min.js',
  'vendor/leaflet.js',
  'vendor/leaflet.css',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'manifest.json',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
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

  // Never cache Supabase database API calls
  if (url.hostname.endsWith('.supabase.co')) return;

  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  const isPage = e.request.mode === 'navigate' || url.pathname.endsWith('.html');

  if (isPage) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request).then((hit) => hit || caches.match('index.html')))
    );
    return;
  }

  // Code (JS/CSS): network-first, cache as fallback.
  //
  // Cache-first was wrong here: a fix to isot.js would not reach anyone until the cache
  // version changed AND the new worker activated, so users could run stale code against a
  // changed database. A stale member card at a bar is worse than one round-trip. Offline
  // still works — the cache is the fallback.
  if (/\.(js|css)$/.test(url.pathname)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Images, icons, fonts: cache-first is right — versioned by filename, never change in place.
  e.respondWith(
    caches.match(e.request).then((hit) => {
      if (hit) return hit;
      return fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      });
    })
  );
});
