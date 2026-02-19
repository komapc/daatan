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

// ============================================
// Push Notifications
// ============================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'DAATAN', body: event.data.text() };
  }

  const options = {
    body: data.body || '',
    icon: '/logo-icon.svg',
    badge: '/logo-icon.svg',
    tag: data.type || 'default',
    data: { url: data.url || '/' },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DAATAN', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if found
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(url);
    })
  );
});
