import type { Page } from '@playwright/test'
import { mintTestSession } from '../../scripts/lib/mint-test-session.mjs'

// Injects a real, freshly-minted test-account session into localStorage
// before the app loads, so tests can start already signed in. See
// docs/architecture.md#testing--automation for why this exists. Returns the
// test account's user id so specs that need to seed rows directly via the
// admin client (rather than driving the UI just to set up fixture state)
// don't have to mint a second session to learn it.
//
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
  const { storageKey, session } = await mintTestSession()

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
