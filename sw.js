// sw.js — Bethel AME Lancaster Service Worker
// Strategy: cache-first for the app shell, network-first for everything else.

const CACHE_NAME = 'bethel-v6';

// Files that make up the app shell — cached immediately on install.
const SHELL_FILES = [
  '/BethelApp/',
  '/BethelApp/index.html',
  '/BethelApp/manifest.json',
  '/BethelApp/logo.png',
  '/BethelApp/icons/192.png',
  '/BethelApp/icons/512.png'
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
      { action: 'open', title: '&#127937; Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      // Support both Firebase FCM format and plain JSON
      if (payload.notification) {
        // Firebase FCM format: { notification: { title, body }, data: { url } }
        title = payload.notification.title || title;
        options.body = payload.notification.body || options.body;
        options.icon = payload.notification.icon || options.icon;
        if (payload.data && payload.data.url) options.data.url = payload.data.url;
      } else {
        // Plain format: { title, body, url }
        title = payload.title || title;
        options.body = payload.body || options.body;
        if (payload.url) options.data.url = payload.url;
        if (payload.icon) options.icon = payload.icon;
      }
    } catch {
      options.body = event.data.text();
    }
  }

  // Save notification to localStorage so app can show it as an in-app banner
  const notifData = JSON.stringify({
    title,
    body: options.body,
    url: options.data.url,
    receivedAt: Date.now()
  });

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      // Save to all open windows
      clients.forEach(client => {
        client.postMessage({ type: 'NOTIF_RECEIVED', title, body: options.body, receivedAt: Date.now() });
      });
    }).then(() => self.registration.showNotification(title, options))
  );
});

// ── Notification click: handle actions and open the app ─────────────
self.addEventListener('notificationclick', event => {
  // If user tapped Dismiss, just close it
  if (event.action === 'dismiss') {
    event.notification.close();
    return;
  }

  // For 'open' action or tapping the notification body — open the app
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url)
    ? new URL(event.notification.data.url, self.location.origin).href
    : 'https://stephhurd1-gif.github.io/BethelApp/';

  // Save notification data so app can show it as an in-app banner
  const notifPayload = event.notification.data || {};
  const notifRecord = JSON.stringify({
    title: event.notification.title,
    body: event.notification.body,
    receivedAt: Date.now()
  });

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If the app is already open, send it the notification data and focus
      for (const client of clientList) {
        if (client.url.includes('stephhurd1-gif.github.io/BethelApp') && 'navigate' in client) {
          client.postMessage({ type: 'NOTIF_CLICKED', title: event.notification.title, body: event.notification.body, receivedAt: Date.now() });
          return client.navigate(target).then(c => c && c.focus());
        }
      }
      // Otherwise open a new window — app will read from localStorage on load
      if (clients.openWindow) {
        return clients.openWindow(target + '?notif=1');
      }
    })
  );
});
