// Cache simples para funcionar offline. Aumente a versão ao publicar mudanças.
const CACHE = "beachtennis-v9";
const FILES = ["./", "./index.html", "./css/style.css", "./js/engine.js", "./js/tourney-logic.js", "./js/store.js", "./js/stats.js", "./js/app.js", "./js/share.js", "./js/history.js", "./js/settings.js", "./js/tourneys.js", "./js/sync.js", "./manifest.json", "./icon-192.png", "./icon-512.png", "./icon-maskable.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Rede primeiro (pega atualizações); se estiver offline, usa o cache
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then((r) => {
      const copy = r.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("./index.html")))
  );
});
