// Version du Service Worker = version de l'app (à garder identique à APP_VERSION dans index.html).
// Modifier ce fichier (ne serait-ce que ce numéro) suffit pour que les navigateurs détectent la mise à jour.
const VERSION = '6.17';
const CACHE_NAME = 'stock-lcd-v' + VERSION;
const ASSETS = ['./index.html', './manifest.json', './icon-192.png', './icon-512.png'];
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css'
];

self.addEventListener('install', (event) => {
  // Ressource par ressource : un échec isolé (icône absente, CDN injoignable) n'empêche pas l'installation.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all([...ASSETS, ...CDN_ASSETS].map((url) =>
        cache.add(new Request(url, {cache: 'reload'})).catch((err) => console.warn('SW install: échec', url, err))))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Jamais d'interception des écritures ni des appels Supabase (données métier) : toujours le réseau, jamais un cache périmé.
  // (Auparavant, les lectures Supabase étaient servies « cache d'abord » → données/clôtures obsolètes qui réapparaissaient.)
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === 'cdn.jsdelivr.net';
  if (!sameOrigin && !isCdn) return;

  const isHTML = req.mode === 'navigate' || (sameOrigin && (url.pathname.endsWith('.html') || url.pathname.endsWith('/')));
  if (isHTML) {
    // Réseau d'abord, en contournant le cache HTTP : une nouvelle version est toujours vue dès qu'elle est en ligne.
    event.respondWith(
      fetch(req, {cache: 'no-store'})
        .then((res) => {
          if (res && res.status === 200 && sameOrigin) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put('./index.html', clone));
          }
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match(req, {ignoreSearch: true})))
    );
    return;
  }

  // Ressources statiques (icônes, manifest, CDN) : cache d'abord, rafraîchi en arrière-plan.
  event.respondWith(
    caches.match(req, {ignoreSearch: true}).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
