// sw.js — Bethel AME Lancaster Service Worker
// Strategy: cache-first for the app shell, network-first for everything else.

const CACHE_NAME = 'bethel-v1';

// Files that make up the app shell — cached immediately on install.
const SHELL_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.png',
  '/icons/192.png',
  '/icons/512.png'
];

// ── Install: pre-cache the app shell ─────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll fails silently on individual misses in some browsers,
      // so we catch per-file to avoid blocking install on a missing icon.
      return Promise.allSettled(
        SHELL_FILES.map(url => cache.add(url).catch(() => {}))
      );
    })
  );
  // Activate immediately without waiting for old tabs to close.
  self.skipWaiting();
});

// ── Activate: remove stale caches ────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

// ── Fetch: cache-first for shell, network-first for dynamic content ──
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Only handle GET requests for same-origin or known CDN assets.
  if (event.request.method !== 'GET') return;

  // Network-first for Google Calendar, JotForm, donate page, and YouTube.
  // These are live/dynamic so we don't want a stale cache.
  const networkFirst = [
    'calendar.google.com',
    'jotform.com',
    'bethelamelancaster.com',
    'youtube.com',
    'zoom.us',
    'freeconference.com',
    'facebook.com',
    'maps.google.com'
  ];

  if (networkFirst.some(domain => url.hostname.includes(domain))) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  // Cache-first for everything else (app shell, icons, logo).
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache valid same-origin responses.
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push: display notification when a message arrives ────────────────
self.addEventListener('push', event => {
  let data = {
    title: 'Bethel AME Lancaster',
    body: 'You have a new message from Bethel.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'bethel-notification',
    url: '/'
  };

  // The push payload is expected to be JSON with title, body, and optionally url.
  // Example payload: { "title": "Service reminder", "body": "Sunday worship at 10 AM", "url": "/" }
  if (event.data) {
    try {
      Object.assign(data, event.data.json());
    } catch {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    renotify: true,
    data: { url: data.url }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// ── Notification click: open or focus the app ─────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If the app is already open, focus it.
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window.
      if (clients.openWindow) {
        return clients.openWindow(target);
      }
    })
  );
});
