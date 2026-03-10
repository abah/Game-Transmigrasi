// ============================================================
// SERVICE WORKER — Transmigrasi: Membangun Negeri
// Cache-first for assets, Network-first for HTML
// ============================================================

const CACHE_NAME = 'transmigrasi-v2';
const ASSETS_CACHE = 'transmigrasi-assets-v2';

// Core app shell (always cache)
const CORE_FILES = [
    '/',
    '/index.html',
    '/css/style.css',
    '/js/data.js',
    '/js/main.js',
    '/js/renderer.js',
    '/js/simulation.js',
    '/js/ui.js',
    '/site.webmanifest',
    '/assets/icons/icon-192.png',
    '/assets/icons/icon-512.png',
    '/assets/icons/apple-touch-icon.png',
    '/assets/icons/og-image.png',
    '/assets/favicon.svg',
];

// ── INSTALL: pre-cache core files ────────────────────────────
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(CORE_FILES).catch((err) => {
                console.warn('[SW] Some core files failed to cache:', err);
            });
        }).then(() => self.skipWaiting())
    );
});

// ── ACTIVATE: clean old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter(k => k !== CACHE_NAME && k !== ASSETS_CACHE)
                    .map(k => caches.delete(k))
            );
        }).then(() => self.clients.claim())
    );
});

// ── FETCH: serve from cache, fall back to network ────────────
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip non-GET and external requests
    if (event.request.method !== 'GET') return;
    if (url.origin !== self.location.origin) return;

    // HTML: network-first (always get fresh game)
    if (event.request.destination === 'document') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // JS/CSS: network-first with cache fallback
    if (event.request.destination === 'script' || event.request.destination === 'style') {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Images/Sprites: cache-first (heavy assets, rarely change)
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(ASSETS_CACHE).then(c => c.put(event.request, clone));
                }
                return response;
            }).catch(() => cached);
        })
    );
});

// ── BACKGROUND SYNC: notify clients of updates ───────────────
self.addEventListener('message', (event) => {
    if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
