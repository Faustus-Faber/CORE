/**
 * CORE Service Worker — offline shell + media caching.
 *
 * Per refinement plan §19 "Should have": PWA installability.
 * Per refinement plan §14.7: media caching for offline evidence viewing.
 *
 * Strategies:
 *  - App shell (HTML/CSS/JS): network-first for navigations, cache-first
 *    for static assets.
 *  - Media assets (/api/media/, /uploads/): stale-while-revalidate with a
 *    dedicated `media-cache-v1` store, capped at 50 entries via LRU
 *    eviction.
 *  - Other API calls: NOT cached — they require network connectivity.
 */

const CACHE_NAME = "core-v1";
const MEDIA_CACHE_NAME = "media-cache-v1";
const MEDIA_CACHE_MAX = 50;
const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== MEDIA_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

/**
 * Is this request for a media/upload asset that should be cached?
 */
function isMediaRequest(url) {
  return url.pathname.startsWith("/api/media/") || url.pathname.startsWith("/uploads/");
}

/**
 * Enforce an LRU cap on the media cache.
 *
 * Cache API preserves insertion order, so the oldest entries are evicted
 * first. We re-put on every cache hit (in the SWR handler) to mark recent
 * use, making eviction effectively LRU.
 */
async function evictMediaCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MEDIA_CACHE_MAX) return;
  const toRemove = keys.slice(0, keys.length - MEDIA_CACHE_MAX);
  await Promise.all(toRemove.map((key) => cache.delete(key)));
}

/**
 * Stale-while-revalidate for media assets (§14.7).
 *
 *  1. Return the cached response immediately if available.
 *  2. Kick off a background fetch to refresh the cache.
 *  3. If no cache, fall back to the network and cache the result.
 *  4. Re-put on every access so eviction is LRU, then cap at 50 entries.
 */
async function mediaStaleWhileRevalidate(request) {
  const cache = await caches.open(MEDIA_CACHE_NAME);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then((response) => {
      // Only cache valid, same-origin, basic responses.
      if (response && response.status === 200 && response.type === "basic") {
        const copy = response.clone();
        cache.put(request, copy).then(() => evictMediaCache(cache));
      }
      return response;
    })
    .catch(() => cached);

  // Re-put the cached entry to mark it as recently used (LRU ordering).
  if (cached) {
    cache.put(request, cached.clone()).then(() => evictMediaCache(cache));
    return cached;
  }

  return networkFetch;
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only handle same-origin GET requests
  if (event.request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // ── Media assets: stale-while-revalidate (§14.7) ──────────────────────
  if (isMediaRequest(url)) {
    event.respondWith(mediaStaleWhileRevalidate(event.request));
    return;
  }

  // Skip other API calls — they need network
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Network-first for navigation, cache fallback
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
    )
  );
});
