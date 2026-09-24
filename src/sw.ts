/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching'

// vite-plugin-pwa's injectManifest strategy replaces __WB_MANIFEST with the
// build's precache list. Switched from the generateSW strategy (see
// docs/architecture.md#pwa-configuration) because a push handler needs a
// hand-written service worker — generateSW doesn't let you inject one.
declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Backlog item 15: rest timer alerts. The payload is plain JSON sent by
// the Edge Function (supabase/functions/rest-timer-notify) — see
// src/stores/pushSubscription.ts for the client side of this.
self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Rest timer', {
      body: data.body ?? 'Time for your next set.',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: 'rest-timer',
    })
  )
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
