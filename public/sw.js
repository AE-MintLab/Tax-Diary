// Tax Diary service worker — plain hand-written SW (no Workbox/vite-plugin-pwa
// dependency). Bump CACHE_VERSION whenever you ship a new build so old
// caches get cleared out.
const CACHE_VERSION = "tax-diary-v3";
const APP_SHELL = [
  "/",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
  "/brand/wordmark.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Strategy split in two:
//
// 1. HTML navigations (loading the app itself): NETWORK-FIRST, falling back
//    to cache only if offline. This matters because Vite gives every build's
//    JS/CSS files unique hashed names — if we served a STALE cached HTML page
//    after a new deployment, it would reference last build's hashed filenames,
//    which no longer exist on the server (Vercel only serves the latest
//    deployment's files), causing a broken/blank app until a second reload.
//    Network-first means: online → always get the current build; offline →
//    fall back to whatever was last cached, so the app still opens.
//
// 2. Everything else (JS/CSS/images/icons): stale-while-revalidate. These are
//    safe to serve from cache instantly since each build's filenames are
//    unique/immutable — a cached JS chunk never goes stale in a way that
//    matters, since a new build simply requests a different filename.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.open(CACHE_VERSION).then((cache) => cache.match(request)).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      const networkFetch = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
