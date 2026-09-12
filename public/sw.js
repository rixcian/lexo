/*
 * lexo service worker.
 *
 * Scope: make the app installable and keep the shell available when the
 * network is flaky. Server-side SQLite stays the single source of truth, so
 * reviews themselves still need the server - navigations are network-first and
 * fall back to a cached offline page, never to stale card data.
 */

const VERSION = "lexo-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;

const SHELL = [
  "/offline",
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.startsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    // Card media is content-addressed under /api/media/<sha256>.<ext>, so it
    // is as immutable as a hashed build asset and caches the same way.
    url.pathname.startsWith("/api/media/") ||
    /\.(?:css|js|woff2?|png|svg|jpg|jpeg|webp|ico|gif|avif|mp3|ogg|oga|opus|wav|m4a|aac|flac|weba)$/.test(
      url.pathname,
    )
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // An <audio> element asks for byte ranges; a 206 cannot go into the cache,
  // so those go straight to the network.
  if (request.headers.has("range")) return;

  // Hashed build output never changes - serve it from cache first.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((response) => {
            // Only a complete 200 is storable - `ok` is also true for a 206.
            if (response.status === 200) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .match("/offline")
          .then((hit) => hit ?? new Response("Offline", { status: 503 })),
      ),
    );
  }
});
