const CACHE_NAME = 'stock-lcd-v25';
const ASSETS = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
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
  // Ne jamais intercepter les requêtes vers un autre domaine (Supabase, etc.) : les laisser
  // passer directement au réseau. Les mettre en cache pourrait faire croire à l'application
  // qu'une synchronisation a réussi alors qu'elle a en réalité reçu une VIEILLE réponse mise
  // en cache — c'est exactement ce qui causait le faux statut "Synchronisé" hors connexion.
  const reqUrl = new URL(event.request.url);
  if(reqUrl.origin !== self.location.origin) return;

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
