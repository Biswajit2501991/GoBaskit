/**
 * Web Push service worker (staff new-order alerts + customer out-for-delivery).
 * Shows system notifications even when the browser tab is minimized.
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
    body: 'GoBaskit update',
    url: '/',
    tag: 'gobaskit',
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
      body: data.body || 'GoBaskit update',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: data.tag || 'gobaskit',
      renotify: true,
      requireInteraction: true,
      data: { url: data.url || '/' },
      vibrate: [160, 80, 160],
    }),
  );
});

function safeNotificationUrl(raw) {
  const origin = self.location.origin;
  let dest;
  try {
    dest = new URL(raw || '/', origin);
  } catch {
    return new URL('/', origin);
  }
  if (dest.origin !== origin) return new URL('/', origin);
  if (dest.pathname.startsWith('/admin')) return dest;
  if (dest.pathname.startsWith('/account')) return dest;
  return new URL('/', origin);
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const dest = safeNotificationUrl(event.notification.data && event.notification.data.url);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const wantAdmin = dest.pathname.startsWith('/admin');
      for (const client of clientList) {
        try {
          const clientUrl = new URL(client.url);
          if (clientUrl.origin !== self.location.origin) continue;
          const isAdminClient = clientUrl.pathname.startsWith('/admin');
          if (wantAdmin !== isAdminClient) continue;
          if ('focus' in client) client.focus();
          if ('navigate' in client) return client.navigate(dest.href);
          return;
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
