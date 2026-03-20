const CACHE_NAME = "dosis-pwa-v11";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Solo manejamos GET
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Solo manejamos http/https
  if (!url.protocol.startsWith("http")) return;

  // Navegación HTML: network first con fallback a cache
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          return (
            (await caches.match(req)) ||
            (await caches.match("./")) ||
            (await caches.match("./index.html"))
          );
        }
      })()
    );
    return;
  }

  // Resto de recursos: cache first + actualización en segundo plano
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) {
        event.waitUntil(updateCache(req));
        return cached;
      }

      try {
        const fresh = await fetch(req);

        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(req, fresh.clone());
        }

        return fresh;
      } catch {
        // Fallback simple para recursos no HTML
        return cached || Response.error();
      }
    })()
  );
});

async function updateCache(req) {
  try {
    const fresh = await fetch(req);
    if (!fresh || !fresh.ok) return;

    const cache = await caches.open(CACHE_NAME);
    await cache.put(req, fresh.clone());
  } catch {
    // Silencio: si falla red, nos quedamos con lo cacheado
  }
}
