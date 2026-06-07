// sw.js — service worker minimal pour « Le collègue ».
// But premier : rendre la PWA installable de façon fiable sur toutes les
// versions de Chrome (un SW avec un handler `fetch` lève toute ambiguïté).
// But second : un hors-ligne SÛR, sans piège de cache.
//
// Principes (volontairement conservateurs) :
//  - /api/*  : JAMAIS touché. Réseau seul, aucun cache. Les données chiffrées,
//              personnelles et l'auth ne transitent jamais par le cache.
//  - Navigations (HTML) : RÉSEAU D'ABORD, repli sur l'app shell en cache si
//              hors-ligne. Donc un redéploiement sert toujours un index.html
//              frais en ligne — pas d'app figée.
//  - Assets statiques (JS/CSS/images, noms hashés par Vite, donc immuables) :
//              CACHE D'ABORD, sinon réseau + mise en cache.
//
// En cas de changement d'assets statiques non hashés (icônes, manifest),
// incrémenter CACHE (v1 -> v2) pour purger l'ancien.
const CACHE = "lecollegue-v3";
const SHELL = "/index.html";

self.addEventListener("install", (event) => {
  // Active immédiatement la nouvelle version sans attendre la fermeture des onglets.
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((c) => c.add(SHELL)).catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  // Purge les anciens caches, puis prend le contrôle des pages ouvertes.
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // On ne gère que le GET same-origin. Tout le reste (POST, externe) passe direct.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;

  // /api/* : jamais de cache (données chiffrées / personnelles / auth).
  if (url.pathname.startsWith("/api/")) return;

  // Navigations (app shell HTML) : réseau d'abord, repli cache hors-ligne.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(SHELL, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(SHELL)),
    );
    return;
  }

  // Assets statiques : cache d'abord, sinon réseau + mise en cache.
  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ||
        fetch(req).then((res) => {
          if (res && res.status === 200 && res.type === "basic") {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        }),
    ),
  );
});