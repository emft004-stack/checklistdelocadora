const CACHE_NAME = 'checklist-locadora-2.5';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];
// Bibliotecas externas guardadas no aparelho para gerar PDF sem internet.
const CDN_LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL).then(function () {
        // Melhor esforço: se falhar agora, é guardada no primeiro uso com internet.
        return Promise.all(CDN_LIBS.map(function (url) {
          return fetch(url, { mode: 'no-cors' }).then(function (resp) {
            return cache.put(url, resp);
          }).catch(function () {});
        }));
      });
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (key) {
        return (key.indexOf('checklist-retirada-') === 0 ||
          key.indexOf('checklist-locadora-') === 0) && key !== CACHE_NAME;
      }).map(function (key) {
        return caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  if (event.request.method !== 'GET') return;
  const url = event.request.url;

  // Bibliotecas externas: cache primeiro.
  if (CDN_LIBS.indexOf(url) !== -1) {
    event.respondWith(
      caches.match(url).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(url, copy);
          }).catch(function () {});
          return response;
        });
      })
    );
    return;
  }

  if (new URL(url).origin !== self.location.origin) return;

  // App: rede primeiro (versão nova sempre que houver internet); cache se offline.
  event.respondWith(
    fetch(event.request).then(function (response) {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(event.request, copy);
        }).catch(function () {});
      }
      return response;
    }).catch(function () {
      return caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        if (event.request.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});
