/**
 * Vitamin English — Service Worker
 *
 * Strategy: Network-first for API calls, cache-first for static assets.
 * Update detection: the browser automatically detects a new SW file (even a
 * 1-byte change) and fires the "updatefound" event that app.js listens to.
 */

const CACHE_VERSION = 'v4';
const STATIC_CACHE  = `vitamin-static-${CACHE_VERSION}`;
const API_CACHE     = `vitamin-api-${CACHE_VERSION}`;

// Core static assets to pre-cache on install
const PRECACHE_URLS = [
    '/',
    '/css/styles.css',
    '/js/app.js',
    '/js/api.js',
    '/js/dateTime.js',
    '/js/i18n.js',
    '/js/monthly-reports.js',
    '/site.webmanifest',
    '/assets/favicon.svg',
    '/assets/apple-touch-icon.png',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
            // Pre-cache core assets; ignore individual failures so a missing
            // optional file doesn't abort the whole install.
            return Promise.allSettled(
                PRECACHE_URLS.map(url => cache.add(url).catch(() => {}))
            );
        })
    );
    // Do NOT call self.skipWaiting() here — we let the app decide when to activate
    // via the "SKIP_WAITING" message so users get a chance to save work first.
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) =>
            Promise.all(
                cacheNames
                    .filter(name =>
                        (name.startsWith('vitamin-static-') || name.startsWith('vitamin-api-')) &&
                        name !== STATIC_CACHE &&
                        name !== API_CACHE
                    )
                    .map(name => caches.delete(name))
            )
        ).then(() => self.clients.claim())
    );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Only handle same-origin requests
    if (url.origin !== self.location.origin) return;

    // API calls: network-first, no caching (data must be fresh)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(fetch(request));
        return;
    }

    // Static assets: cache-first with network fallback
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) return cached;
            return fetch(request).then((response) => {
                // Cache successful GET responses for static assets
                if (response && response.status === 200 && request.method === 'GET') {
                    const clone = response.clone();
                    caches.open(STATIC_CACHE).then(cache => cache.put(request, clone));
                }
                return response;
            }).catch(() => {
                // For navigation requests, serve the app shell from cache
                if (request.mode === 'navigate') {
                    return caches.match('/');
                }
            });
        })
    );
});

// ─── Message Handler ──────────────────────────────────────────────────────────
// The app sends "SKIP_WAITING" when the user taps the update notification.
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
