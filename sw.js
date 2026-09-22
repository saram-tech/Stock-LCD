const CACHE_NAME = 'stock-lcd-v29';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  // Peuple le cache asset par asset (et non via cache.addAll) : si une seule ressource de la liste
  // est absente/404 (ex. une icône), cache.addAll ferait échouer l'installation ENTIÈRE du nouveau
  // Service Worker — et donc bloquerait silencieusement toute mise à jour de l'app. Ici, un échec
  // isolé n'empêche pas l'activation de la nouvelle version.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(ASSETS.map((url) => cache.add(url).catch((err) => console.warn('SW install: échec', url, err))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isHTML = event.request.mode === 'navigate' || event.request.url.endsWith('.html');

  if (isHTML) {
    // Réseau en priorité pour le HTML : garantit qu'un correctif déployé est bien chargé.
    // Le cache ne sert de secours que si le réseau est indisponible (mode hors ligne).
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache en priorité pour le reste (icônes, manifest) : plus rapide, change rarement.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
