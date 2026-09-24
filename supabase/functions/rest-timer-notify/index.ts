// Backlog item 15: per-exercise rest timer notification.
//
// Called once per logged set (see src/stores/pushSubscription.ts) with the
// device's PushSubscription and the configured rest duration. Sleeps for
// that duration, then sends the push directly — no pg_cron/polling needed,
// since the whole thing fits comfortably inside Supabase's free-tier Edge
// Function limits (150s wall clock, 2s of *active* CPU time — the sleep is
// async wait, not CPU — confirmed 2026-09-24, see docs/backlog-archive.md).
//
// Requires these secrets (`supabase secrets set NAME=value`), never client-
// exposed, same handling as the service role key:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (a mailto: contact)
//
// Deployed with JWT verification on (the default) — supabase.functions.invoke
// from the client attaches the signed-in user's access token automatically,
// so an unauthenticated caller can't reach this at all. That's the only
// authorization check here; there is no ownership check tying the supplied
// subscription to the caller, since a wrong/stale subscription just fails to
// deliver a push rather than exposing another user's data.
import webpush from 'npm:web-push@3.6.7'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:dephillips1977@gmail.com'

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
}

// Matches the free-tier 150s wall-clock cap with headroom to spare, and
// rejects anything wildly out of the 30-90s real-world range the design
// settled on (docs/backlog.md item 15) rather than trusting the client.
const MAX_REST_SECONDS = 120

interface PushSubscriptionPayload {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface RequestBody {
  subscription: PushSubscriptionPayload
  restSeconds: number
  exerciseName?: string
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { subscription, restSeconds, exerciseName } = body
  if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    return new Response(JSON.stringify({ error: 'Missing or malformed subscription' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (typeof restSeconds !== 'number' || restSeconds <= 0) {
    return new Response(JSON.stringify({ error: 'restSeconds must be a positive number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const clampedSeconds = Math.min(restSeconds, MAX_REST_SECONDS)
  await sleep(clampedSeconds * 1000)

  const payload = JSON.stringify({
    title: 'Rest over',
    body: exerciseName ? `Time for your next set of ${exerciseName}.` : 'Time for your next set.',
  })

  try {
    await webpush.sendNotification(subscription, payload)
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
