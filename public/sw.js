/// <reference lib="webworker" />
/* Simple SW for CineCritique: cache shell + runtime cache for search API */
/** @type {ServiceWorkerGlobalScope} */
const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));
const CACHE_PREFIX = 'cinecritique-cache-v1';
const RUNTIME_CACHE = `${CACHE_PREFIX}-runtime`;
const PRECACHE = `${CACHE_PREFIX}-precache`;

const PRECACHE_URLS = [
  '/',
  '/favicon.ico',
  '/manifest.webmanifest',
];

sw.addEventListener('install', /** @param {ExtendableEvent} event */ (event) => {
  event.waitUntil(
    caches.open(PRECACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => sw.skipWaiting())
  );
});

sw.addEventListener('activate', /** @param {ExtendableEvent} event */ (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => !k.startsWith(CACHE_PREFIX)).map((k) => caches.delete(k))
    )).then(() => sw.clients.claim())
  );
});

/**
 * @param {Request} req
 */
function isApiMoviesRequest(req) {
  try {
    const url = new URL(req.url);
    return url.pathname === '/api/movies' && req.method === 'GET';
  } catch { return false; }
}

/**
 * @param {Request} req
 */
function isStaticAsset(req) {
  try {
    const url = new URL(req.url);
    return url.pathname.startsWith('/_next/static/') || url.pathname.endsWith('.css') || url.pathname.endsWith('.js');
  } catch { return false; }
}

sw.addEventListener('fetch', /** @param {FetchEvent} event */ (event) => {
  const { request } = event;
  // Only handle GET
  if (request.method !== 'GET') return;

  // Strategy 1: Stale-While-Revalidate for search API
  if (isApiMoviesRequest(request)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        } catch {
          return new Response(
            JSON.stringify({ movies: [], count: 0, weighted: {}, breakdown: {} }),
            { headers: { 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      })
    );
    return;
  }

  // Strategy 2: Cache-first for static Next assets
  if (isStaticAsset(request)) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const res = await fetch(request);
          if (res && res.status === 200) cache.put(request, res.clone());
          return res;
        } catch {
          return cached || Response.error();
        }
      })
    );
    return;
  }

  // For navigation requests, try network then cache, then fall back to offline shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/').then((res) => res ?? Response.error()))
    );
  }
});
