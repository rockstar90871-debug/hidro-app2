const APP_VERSION = "v3";
const STATIC_CACHE = `hidroponia-static-${APP_VERSION}`;
const DYNAMIC_CACHE = `hidroponia-dynamic-${APP_VERSION}`;

// Archivos esenciales de la app
const STATIC_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./styles.css",
  "./app.js",
  "./icon-192.png",
  "./icon-512.png"
];

// ---------- INSTALL ----------
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => {
      return cache.addAll(STATIC_FILES);
    })
  );
  self.skipWaiting();
});

// ---------- ACTIVATE ----------
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => ![STATIC_CACHE, DYNAMIC_CACHE].includes(key))
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ---------- FETCH ----------
self.addEventListener("fetch", event => {
  const { request } = event;

  // Solo GET
  if (request.method !== "GET") return;

  // 🔹 Archivos estáticos (HTML, CSS, JS, imágenes)
  if (
    request.destination === "document" ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 🔹 Datos dinámicos (futuro Firebase / APIs)
  event.respondWith(networkFirst(request));
});

// ---------- ESTRATEGIAS ----------

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    return caches.match("./index.html");
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, response.clone());
    return response;
  } catch (e) {
    return caches.match(request);
  }
}
