// =====================================================
// ECO-TRANS — Service Worker
// Cache offline + mise à jour automatique
// =====================================================

const CACHE_NAME = 'ecotrans-v1.0.0';

// Fichiers à mettre en cache pour le mode hors-ligne
const ASSETS = [
  './ecotrans-client.html',
  './manifest.json'
];

// ---- INSTALLATION : mise en cache des assets ----
self.addEventListener('install', event => {
  console.log('[SW] Installation en cours...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Mise en cache des fichiers');
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ---- ACTIVATION : suppression des anciens caches ----
self.addEventListener('activate', event => {
  console.log('[SW] Activation...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Suppression ancien cache:', key);
            return caches.delete(key);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ---- FETCH : stratégie Cache First puis Network ----
self.addEventListener('fetch', event => {
  // Ne pas intercepter les requêtes non-GET
  if (event.request.method !== 'GET') return;

  // Pour les polices Google Fonts → Network First
  if (event.request.url.includes('fonts.googleapis.com') ||
      event.request.url.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Pour tout le reste → Cache First avec fallback réseau
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) {
        console.log('[SW] Servi depuis le cache:', event.request.url);
        return cached;
      }
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Page offline de secours
        if (event.request.destination === 'document') {
          return caches.match('./ecotrans-client.html');
        }
      });
    })
  );
});

// ---- MESSAGE : forcer la mise à jour ----
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
