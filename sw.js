// sw.js — Bethel AME Lancaster Service Worker v6
const CACHE_NAME = 'bethel-v6';

const SHELL_FILES = [
  '/BethelApp/manifest.json',
  '/BethelApp/logo.png',
  '/BethelApp/icons/192.png',
  '/BethelApp/icons/512.png'
];

// ── Install: pre-cache static assets (NOT index.html) ────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  self.skipWaiting();
});

// ── Activate: remove stale caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch strategy ────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Always network-first for index.html so updates reach users instantly
  if (url.pathname === '/BethelApp/' || url.pathname === '/BethelApp/index.html') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Cache the fresh version
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request)) // fallback to cache if offline
    );
    return;
  }

  // Network-first for dynamic/external content
  const networkFirst = [
    'calendar.google.com', 'jotform.com', 'bethelamelancaster.com',
    'youtube.com', 'zoom.us', 'freeconference.com', 'facebook.com',
    'maps.google.com', 'bible.com', 'biblegateway.com',
    'gstatic.com', 'googleapis.com', 'cloudfunctions.net'
  ];

  if (networkFirst.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Cache-first for static assets (icons, logo, manifest)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push: display notification ────────────────────────────────────────
self.addEventListener('push', event => {
  let title = 'Bethel AME Lancaster';
  let options = {
    body: 'You have a new message from Bethel.',
    icon: '/BethelApp/icons/192.png',
    badge: '/BethelApp/icons/192.png',
    tag: 'bethel-notification',
    renotify: true,
    requireInteraction: true,
    data: { url: '/BethelApp/' },
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload.notification) {
        title = payload.notification.title || title;
        options.body = payload.notification.body || options.body;
        options.icon = payload.notification.icon || options.icon;
        if (payload.data && payload.data.url) options.data.url = payload.data.url;
      } else {
        title = payload.title || title;
        options.body = payload.body || options.body;
        if (payload.url) options.data.url = payload.url;
        if (payload.icon) options.icon = payload.icon;
      }
    } catch {
      options.body = event.data.text();
    }
  }

  // Notify any open app windows so they can show the in-app banner
  self.clients.matchAll({ type: 'window' }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NOTIF_RECEIVED',
        title,
        body: options.body,
        receivedAt: Date.now()
      });
    });
  });

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  if (event.action === 'dismiss') {
    event.notification.close();
    return;
  }

  event.notification.close();

  const target = (event.notification.data && event.notification.data.url)
    ? new URL(event.notification.data.url, self.location.origin).href
    : 'https://stephhurd1-gif.github.io/BethelApp/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('stephhurd1-gif.github.io/BethelApp') && 'navigate' in client) {
          client.postMessage({
            type: 'NOTIF_CLICKED',
            title: event.notification.title,
            body: event.notification.body,
            receivedAt: Date.now()
          });
          return client.navigate(target).then(c => c && c.focus());
        }
      }
      if (clients.openWindow) return clients.openWindow(target + '?notif=1');
    })
  );
});
