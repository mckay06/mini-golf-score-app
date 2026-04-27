const CACHE_NAME = 'mini-golf-score-v16';
const ASSETS = [
  '/mini-golf',
  '/mini-golf/',
  '/mini-golf/styles.css',
  '/mini-golf/app.js',
  '/mini-golf/manifest.webmanifest',
  '/mini-golf/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(fetchFresh(event.request));
});

async function fetchFresh(request) {
  const cache = await caches.open(CACHE_NAME);

  try {
    const response = await fetch(request);
    if (response.ok && isAppAsset(request)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (_error) {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    throw _error;
  }
}

function isAppAsset(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin && url.pathname.startsWith('/mini-golf');
}
