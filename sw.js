/* Taylormade Academy service worker.
   - Navigations: network-first (always fresh when online), fall back to cache, then a branded offline page.
   - Static assets (css/js/img/font, including ?v= versioned ones): cache-first, then network.
   - Cross-origin (Google Fonts, Supabase) is passed straight through, never intercepted.
   Bump VERSION to force every client onto a clean cache. */
const VERSION = '2026-06-26a';
const APP_CACHE = 'tma-app-' + VERSION;
const RUNTIME = 'tma-rt-' + VERSION;
const OFFLINE_URL = '/offline/';

const PRECACHE = [
  '/',
  '/store/',
  '/community/',
  '/library/',
  '/login/',
  '/about/',
  '/pricing/',
  OFFLINE_URL,
  '/manifest.webmanifest',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/assets/apple-touch-icon.png',
  '/assets/logo-nav.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    // allSettled so one missing URL never aborts the whole install
    await Promise.allSettled(
      PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k !== APP_CACHE && k !== RUNTIME).map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // fonts CDN, Supabase, Stripe — leave alone

  // Page navigations: network-first.
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
        return fresh;
      } catch (_) {
        const cached = await caches.match(req);
        return cached || (await caches.match(OFFLINE_URL)) || (await caches.match('/'));
      }
    })());
    return;
  }

  // Static assets: cache-first.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh && fresh.status === 200 && fresh.type === 'basic') {
        const cache = await caches.open(RUNTIME);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (_) {
      return cached || Response.error();
    }
  })());
});
