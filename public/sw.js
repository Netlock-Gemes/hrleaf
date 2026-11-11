/*
 * HRLeaf service worker.
 * - App files (/_next/static) are cached forever: their names change with every build.
 * - Notes you open are kept (network first), so they can be read offline. At most 40.
 * - Sign-in, admin and share-link pages are never cached.
 * Signing out deletes the "hrleaf-pages" cache.
 */
const ASSETS = "hrleaf-assets-v1";
const PAGES = "hrleaf-pages";
const OFFLINE = "/offline.html";
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSETS).then((c) => c.add(OFFLINE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("hrleaf-assets-") && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const NEVER_CACHE = /^\/(s|api)\/|^\/(ainzooalgown|login|logout|privacy)(\/|$)/;

async function trim(cache) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_PAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      }),
    );
    return;
  }

  if (req.mode !== "navigate" || NEVER_CACHE.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      try {
        const res = await fetch(req);
        const type = res.headers.get("content-type") || "";
        // Only keep real pages the person could see (not redirects to sign-in, not errors).
        if (res.ok && !res.redirected && type.includes("text/html")) {
          const cache = await caches.open(PAGES);
          await cache.delete(req, { ignoreSearch: true });
          await cache.put(url.pathname, res.clone());
          trim(cache);
        }
        return res;
      } catch {
        const cached = await caches.match(url.pathname, { cacheName: PAGES });
        return cached || (await caches.match(OFFLINE)) || Response.error();
      }
    })(),
  );
});
