// Japon 2026 — service worker : l'app et ses données restent disponibles hors ligne.
const VERSION = "2026-10-06-2114";
const CORE = "japon-core-" + VERSION;
const EXT = "japon-ext"; // photos et fiches Wikipédia : gardées d'une version à l'autre
const FILES = ["./", "./index.html", "./data.json", "./allergie.jpg", "./manifest.webmanifest", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CORE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("japon-core-") && k !== CORE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Réseau d'abord avec délai court, cache sinon (pour recevoir les mises à jour sans bloquer hors ligne)
async function networkFirst(req, key) {
  const cache = await caches.open(CORE);
  const cached = await cache.match(key || req);
  const net = fetch(req).then(r => { if (r.ok) cache.put(key || req, r.clone()); return r; }).catch(() => null);
  const timeout = new Promise(res => setTimeout(() => res(null), 3000));
  return (await Promise.race([net, timeout])) || cached || (await net) || new Response("Hors ligne", {status: 503});
}
// Cache d'abord (photos, fiches) : rapide et hors ligne
async function cacheFirst(req) {
  const cache = await caches.open(EXT);
  const hit = await cache.match(req);
  if (hit) return hit;
  try { const r = await fetch(req); if (r.ok || r.type === "opaque") cache.put(req, r.clone()); return r; }
  catch (_) { return new Response("", {status: 504}); }
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    if (req.mode === "navigate") return e.respondWith(networkFirst(req, "./index.html"));
    if (url.pathname.endsWith("/data.json")) return e.respondWith(networkFirst(req, "./data.json"));
    return e.respondWith(caches.match(req).then(c => c || fetch(req)));
  }
  if (/(^|\.)(wikipedia|wikimedia)\.org$/.test(url.hostname)) {
    return e.respondWith(cacheFirst(req));
  }
  // Open-Meteo : géré par l'app (mémoire locale), on laisse passer
});
