const CACHE_NAME = "dosis-pwa-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(APP_SHELL);
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!url.protocol.startsWith("http")) return;

  // Navegación HTML: cache-first para máxima autonomía offline
  if (req.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cachedPage =
          (await caches.match("./index.html")) ||
          (await caches.match("./"));

        if (cachedPage) return cachedPage;

        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE_NAME);
          await cache.put("./index.html", fresh.clone());
          return fresh;
        } catch {
          return new Response("Sin conexión y sin caché disponible.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
        }
      })()
    );
    return;
  }

  // Resto de recursos: cache-first
  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      if (cached) return cached;

      try {
        const fresh = await fetch(req);

        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(req, fresh.clone());
        }

        return fresh;
      } catch {
        return Response.error();
      }
    })()
  );
});
