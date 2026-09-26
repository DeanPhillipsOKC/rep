import type { Page } from '@playwright/test'
import { mintTestSession } from '../../scripts/lib/mint-test-session.mjs'

// Injects a real, freshly-minted test-account session into localStorage
// before the app loads, so tests can start already signed in. See
// docs/architecture.md#testing--automation for why this exists. Returns the
// test account's user id so specs that need to seed rows directly via the
// admin client (rather than driving the UI just to set up fixture state)
// don't have to mint a second session to learn it.
//
// Item 82: minting is a real generateLink + verifyOtp network round trip
// (with its own rate-limit retries), and the old per-test call added one of
// these to every single test -- roughly 50 across the suite. Each Playwright
// worker is a long-lived process that runs many tests in sequence, so the
// mint is cached here per worker instead and reused across all of that
// worker's tests, re-minting only once the cached session is within a
// minute of its own expiry (a worker's share of the suite is minutes, not
// hours, but this keeps a slow/retried run from signing in with a dead
// token instead of silently failing every subsequent test).
let cachedSession: Awaited<ReturnType<typeof mintTestSession>> | undefined

const SESSION_EXPIRY_SAFETY_MARGIN_MS = 60_000

async function getWorkerSession() {
  const expiresAtMs = (cachedSession?.session.expires_at ?? 0) * 1000
  if (!cachedSession || expiresAtMs < Date.now() + SESSION_EXPIRY_SAFETY_MARGIN_MS) {
    cachedSession = await mintTestSession()
  }
  return cachedSession
}

// `beforeNavigate`, if given, runs after the session is minted (so it has
// the user id) but before the one and only `page.goto('/')` — for seeding
// rows that must exist at the app's first mount. Seeding *after* navigating
// instead (via a second `page.reload()`) would leave two overlapping
// `fetchProgressStats()`-style onMounted fetches in flight; whichever
// resolves last wins the Pinia store write regardless of which was issued
// more recently, which silently reintroduced a stale "this week" count in
// e2e/progress-strip.spec.ts when first tried this way (docs/backlog.md
// item 58).
export async function signInAsTestUser(page: Page, options?: { beforeNavigate?: (userId: string) => Promise<void> }) {
  const { storageKey, session } = await getWorkerSession()

  if (options?.beforeNavigate) await options.beforeNavigate(session.user.id)

  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [storageKey, JSON.stringify(session)]
  )

  await page.goto('/')

  return session.user.id
}
