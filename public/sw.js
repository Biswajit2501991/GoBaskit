/**
 * Admin Web Push service worker.
 * Shows system notifications (with sound) even when the browser tab is minimized.
 */
/* eslint-disable no-restricted-globals */

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'GoBaskit',
    body: 'New order received',
    url: '/admin/orders',
    tag: 'gobaskit-order',
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* keep defaults */
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'GoBaskit', {
      body: data.body || 'New order received',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'gobaskit-order',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/admin/orders' },
      vibrate: [160, 80, 160],
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const raw = (event.notification.data && event.notification.data.url) || '/admin/orders';
  let dest;
  try {
    dest = new URL(raw, self.location.origin);
    if (dest.origin !== self.location.origin) {
      dest = new URL('/admin/orders', self.location.origin);
    }
    if (!dest.pathname.startsWith('/admin')) {
      dest = new URL('/admin/orders', self.location.origin);
    }
  } catch {
    dest = new URL('/admin/orders', self.location.origin);
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin === self.location.origin && clientUrl.pathname.startsWith('/admin')) {
            if ('focus' in client) client.focus();
            if ('navigate' in client) return client.navigate(dest.href);
            return;
          }
        } catch {
          /* skip bad client url */
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(dest.href);
      }
    }),
  );
});
