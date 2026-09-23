import type { Page } from '@playwright/test'
import { mintTestSession } from '../../scripts/lib/mint-test-session.mjs'

// Injects a real, freshly-minted test-account session into localStorage
// before the app loads, so tests can start already signed in. See
// docs/architecture.md#testing--automation for why this exists.
export async function signInAsTestUser(page: Page) {
  const { storageKey, session } = await mintTestSession()

  await page.addInitScript(
    ([key, value]) => {
      localStorage.setItem(key, value)
    },
    [storageKey, JSON.stringify(session)]
  )

  await page.goto('/')
}
