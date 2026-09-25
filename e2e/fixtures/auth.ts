import type { Page } from '@playwright/test'
import { mintTestSession } from '../../scripts/lib/mint-test-session.mjs'

// Injects a real, freshly-minted test-account session into localStorage
// before the app loads, so tests can start already signed in. See
// docs/architecture.md#testing--automation for why this exists. Returns the
// test account's user id so specs that need to seed rows directly via the
// admin client (rather than driving the UI just to set up fixture state)
// don't have to mint a second session to learn it.
export async function signInAsTestUser(page: Page) {
  const { storageKey, session } = await mintTestSession()

  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [storageKey, JSON.stringify(session)]
  )

  await page.goto('/')

  return session.user.id
}
