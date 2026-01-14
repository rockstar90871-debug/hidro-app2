const APP_VERSION = "v4";

const STATIC_CACHE = `hidroponia-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `hidroponia-dynamic-${APP_VERSION}`;
const IMAGE_CACHE = `hidroponia-images-${APP_VERSION}`;

const STATIC_FILES = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./styles.css",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png"
];

// ---------- INSTALL ----------
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache =>
      Promise.allSettled(
        STATIC_FILES.map(file => cache.add(file))
      )
    )
  );
  self.skipWaiting();
});

// ---------- ACTIVATE ----------
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(
            key =>
              ![STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE].includes(key)
          )
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---------- FETCH ----------
self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  // Navegación / HTML
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, STATIC_CACHE));
    return;
  }

  // CSS / JS
  if (
    request.destination === "style" ||
    request.destination === "script"
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // Imágenes
  if (request.destination === "image") {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // APIs / datos
  event.respondWith(networkFirst(request, DYNAMIC_CACHE));
});

// ---------- ESTRATEGIAS ----------

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  if (cached) return cached;

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const response = await fetch(request);
    cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || cache.match("./offline.html");
  }
}
