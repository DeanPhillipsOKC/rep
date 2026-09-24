import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'

// Backlog item 15: rest timer alerts ride on real Web Push (VAPID), not a
// foreground-only setTimeout — see docs/architecture.md#push-notifications
// for why. This store owns the device's subscription lifecycle: asking for
// permission, registering with the push service via the service worker, and
// persisting the subscription server-side so the Edge Function has
// something to send to later. It does NOT own scheduling a given rest
// reminder — see sendRestReminder below, called from WorkoutLogger.vue
// right after a set is logged.

// applicationServerKey wants a raw Uint8Array, but the VAPID public key
// arrives as URL-safe base64 (see VITE_VAPID_PUBLIC_KEY).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)))
}

// `navigator.serviceWorker.ready` never rejects — if the service worker
// never reaches an active/controlling state (e.g. a stuck update on a
// device that had the app open before a deploy), it just hangs forever with
// no error. Found 2026-09-24: enable() had no error handling at all, so any
// failure anywhere in its chain — this included — looked like the button
// silently doing nothing, with zero information to debug from. Bounding it
// turns that into an actual error message.
function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export const usePushSubscriptionStore = defineStore('pushSubscription', () => {
  const subscribed = ref(false)
  const errorMessage = ref('')

  // iOS only exposes these APIs once the PWA is installed to the home
  // screen (docs/architecture.md#push-notifications); a plain browser tab
  // simply won't have them, which this flags rather than throwing on.
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

  // Reflects whatever the platform already knows about (e.g. a previous
  // session already subscribed this device) without prompting for anything.
  async function refreshStatus() {
    if (!supported) return
    try {
      const registration = await withTimeout(navigator.serviceWorker.ready, 8000, 'timed out')
      const existing = await registration.pushManager.getSubscription()
      subscribed.value = existing !== null
    } catch {
      // Background status check — a hung/unregistered service worker just
      // leaves `subscribed` false rather than surfacing anything; the
      // button click path (enable(), above) is what actually reports errors.
    }
  }

  // The deliberate, user-gesture-triggered "Enable rest timer alerts"
  // button flow. iOS refuses to prompt for notification permission except
  // from inside a real click handler, so this must never be called from
  // onMounted or any other non-gesture path.
  async function enable() {
    errorMessage.value = ''
    if (!supported) {
      errorMessage.value = 'Push notifications are not supported on this device/browser.'
      return { error: new Error(errorMessage.value) }
    }

    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        errorMessage.value = 'Notification permission was not granted.'
        return { error: new Error(errorMessage.value) }
      }

      const registration = await withTimeout(
        navigator.serviceWorker.ready,
        8000,
        'Service worker did not become ready in time. Try closing and reopening the app.'
      )
      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY) as BufferSource,
        }))

      const { data: userData } = await supabase.auth.getUser()
      const userId = userData.user?.id
      if (!userId) {
        errorMessage.value = 'Not signed in'
        return { error: new Error(errorMessage.value) }
      }

      const json = subscription.toJSON()
      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, endpoint: json.endpoint!, p256dh: json.keys!.p256dh, auth: json.keys!.auth },
          { onConflict: 'endpoint' }
        )

      if (error) {
        errorMessage.value = error.message
        return { error }
      }
      subscribed.value = true
      return { error: null }
    } catch (err) {
      errorMessage.value = err instanceof Error ? err.message : String(err)
      return { error: err instanceof Error ? err : new Error(errorMessage.value) }
    }
  }

  // Fire-and-forget from the caller's perspective: the Edge Function holds
  // the delay server-side (await sleep(restSeconds) then send), so this
  // resolves as soon as the invoke request lands, not after the rest period
  // elapses. Silently no-ops if this device was never subscribed — the rest
  // timer alert is a convenience, not something addSet should fail over.
  async function sendRestReminder(exerciseName: string, restSeconds: number) {
    if (!supported) return
    try {
      const registration = await withTimeout(navigator.serviceWorker.ready, 8000, 'timed out')
      const subscription = await registration.pushManager.getSubscription()
      if (!subscription) return

      await supabase.functions.invoke('rest-timer-notify', {
        body: { subscription: subscription.toJSON(), restSeconds, exerciseName },
      })
    } catch {
      // Fire-and-forget from addSet's perspective (see WorkoutLogger.vue) —
      // the rest timer alert is a convenience, not something a set-log
      // should fail over, so a hung service worker or a failed invoke just
      // means no reminder this time rather than an error surfaced mid-workout.
    }
  }

  return { subscribed, supported, errorMessage, refreshStatus, enable, sendRestReminder }
})
