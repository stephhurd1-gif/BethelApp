# Bethel AME Lancaster — PWA Setup Guide

## Files in this release

```
index.html      ← Main app (all 9 checklist fixes applied)
manifest.json   ← PWA manifest (enables "Add to Home Screen")
sw.js           ← Service worker (offline support + push notifications)
icons/
  icon-192.png  ← You need to create this (see below)
  icon-512.png  ← You need to create this (see below)
```

---

## What was fixed

1. **Unclosed div bug** — `info-box` and `service-times` divs are now properly closed. The "Church Life" card and cards below it now render correctly.
2. **PWA manifest** — `manifest.json` linked in `<head>`. The app can now be installed as a standalone app on iOS and Android.
3. **Service worker** — `sw.js` registered. Provides offline support and is the foundation for push notifications.
4. **Push notification flow** — A banner appears after the user's first tap asking to allow notifications. Permission is requested only after interaction (browsers require this).
5. **Lazy-loaded iframes** — Give, Events, and Connect iframes now use `data-src` and only load when that tab is first opened. Saves bandwidth on every page load.
6. **App icons declared** — `<link rel="apple-touch-icon">` and `<link rel="icon">` added in `<head>` and in `manifest.json`.
7. **Inline styles replaced** — `style="margin-top:8px"` replaced with `.mt-8` utility class.
8. **IIFE removed** — Script is cleaner without the unnecessary wrapper.
9. **aria-label added** — All nav buttons and action buttons now have `aria-label` for screen reader accessibility. Icon characters marked `aria-hidden="true"`.

---

## Icon files you need to create

You need two PNG icons placed in an `icons/` folder next to `index.html`:

- `icons/icon-192.png` — 192×192 pixels
- `icons/icon-512.png` — 512×512 pixels

**Easiest way:** Use your existing logo.png and resize it. Free tools:
- https://www.pwabuilder.com/imageGenerator — upload your logo, downloads all sizes
- https://squoosh.app — resize manually

---

## Enabling push notifications (next step)

The service worker is ready to receive pushes. To actually send them, you need a push backend. The recommended free option for a GitHub Pages site is **Firebase Cloud Messaging (FCM)**.

### Setup steps (one-time):

1. Go to https://console.firebase.google.com and create a project called "Bethel AME".
2. In Project Settings → Cloud Messaging, copy your **VAPID public key**.
3. In `index.html`, find the comment:
   ```
   // TODO: subscribe to your push backend here
   ```
   Replace it with:
   ```js
   const reg = await navigator.serviceWorker.ready;
   const subscription = await reg.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: 'YOUR_VAPID_PUBLIC_KEY_HERE'
   });
   // Send `subscription` to your Firebase function or backend endpoint
   console.log('Subscribed:', JSON.stringify(subscription));
   ```
4. Store subscriptions in Firebase Firestore.
5. To send a notification, call the FCM HTTP API with your server key and the stored subscription.

### Sending a notification (example payload):
```json
{
  "title": "Sunday Service Reminder",
  "body": "Worship begins at 10:00 AM. See you there!",
  "url": "/"
}
```

The service worker will display this as a native notification on the user's device.

---

## Hosting on GitHub Pages

Make sure your repo has:
- `index.html` at the root
- `manifest.json` at the root  
- `sw.js` at the root (must be at root — service workers only control pages at their scope level)
- `icons/icon-192.png` and `icons/icon-512.png`

The site must be served over **HTTPS** for the service worker and push notifications to work. GitHub Pages provides HTTPS automatically.
