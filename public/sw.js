self.addEventListener('install', (event) => {
  // Take control immediately to kill the old SW
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Claims all clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Delete all caches to ensure fresh start
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            console.log('SW: Deleting cache', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  // Pass through all requests, do not cache anything
  // This effectively disables the SW for network traffic
  return;
});
