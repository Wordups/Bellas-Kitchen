// Bella's Kitchen — service worker
// Strategy:
//   - shell assets: cache-first, network-fallback (so the PWA opens offline)
//   - everything else: network-first, cache-fallback
//   - Supabase/CDN: network-only (don't try to cache API responses)
//
// Offline order queue: when app.js can't reach Supabase, it stashes the order
// in localStorage and listens for 'online' to replay. (Implemented in the
// storage layer rather than here so it works without a cloud config too.)

const VERSION = 'bk-v3-2026-05-20';

const SHELL = [
  './',
  './index.html',
  './app.html',
  './kitchen.html',
  './leaderboard.html',
  './manifest.json',
  './css/styles.css',
  './js/meals.js',
  './js/gamify.js',
  './js/pwa.js',
  './js/supabase-client.js',
  './js/app.js',
  './js/kitchen.js',
  './js/leaderboard.js',
  './js/landing.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION).then(c => c.addAll(SHELL).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle same-origin GETs (skip Supabase, Google Fonts CSS, etc.)
  if (req.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Shell: cache-first
  if (SHELL.some(path => url.pathname.endsWith(path.replace('./', '/')))) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match('./index.html')))
    );
    return;
  }

  // Everything else: network-first
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(VERSION).then(c => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req))
  );
});
