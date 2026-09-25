/// <reference lib="webworker" />

import { clientsClaim } from 'workbox-core'
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

// vite-plugin-pwa's injectManifest strategy replaces __WB_MANIFEST with the
// build's precache list. Switched from the generateSW strategy (see
// docs/architecture.md#pwa-configuration) because a push handler needs a
// hand-written service worker — generateSW doesn't let you inject one.
declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// router.ts gave the app real paths (/history, /templates, /exercises)
// instead of one URL with in-memory view state, so the app shell's "must
// load without network" guarantee (docs/architecture.md#pwa-configuration)
// now has to cover a navigation to any of those, not just "/" — only "/"
// itself is in the precache manifest above. Route every same-origin
// navigation request to the cached index.html, same as public/_redirects
// does for Cloudflare Pages when there's a network but no server-side route.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')))

// generateSW auto-adds this pair for `registerType: 'autoUpdate'`; injectManifest
// doesn't, so it has to be done by hand here — without it, a newly installed SW
// sits in "waiting" until every open tab/PWA window fully closes, which for an
// installed, rarely-fully-quit PWA meant it never happened without an
// uninstall/reinstall. `clientsClaim()` then hands control of already-open
// clients to the new SW as soon as it activates, instead of only future
// navigations. Paired with `registerSW({ immediate: true })` in main.ts, which
// posts SKIP_WAITING as soon as an update is found and reloads the page on
// `controllerchange`.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})
clientsClaim()

// Backlog item 15: rest timer alerts. The payload is plain JSON sent by
// the Edge Function (supabase/functions/rest-timer-notify) — see
// src/stores/pushSubscription.ts for the client side of this.
//
// No browser supports a custom sound file via the Notification API (the old
// `sound` option was never implemented anywhere) — the OS/browser's own
// default notification sound is all that's available, and it plays
// automatically unless `silent` is set (it isn't, here) or the device is on
// silent/DND. `vibrate` is the one thing we *can* set explicitly (Android
// only, Safari ignores it) — worth it since a chime is easy to miss over
// gym noise. `renotify: true` makes a second alert while the previous one's
// still showing re-trigger sound/vibration instead of silently replacing it
// (both notifications share `tag: 'rest-timer'` so only one shows at a time).
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {}
  // TS's lib.webworker.d.ts NotificationOptions is missing `renotify` and
  // `vibrate` despite both being real, supported Notifications API members.
  const options: NotificationOptions & { renotify?: boolean; vibrate?: number[] } = {
    body: data.body ?? 'Time for your next set.',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: 'rest-timer',
    renotify: true,
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(data.title ?? 'Rest timer', options))
})

// Focuses an already-open tab instead of always opening a new one.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      return self.clients.openWindow('/')
    })
  )
})
