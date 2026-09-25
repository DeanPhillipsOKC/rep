import type { Page } from '@playwright/test'

// Backlog item 38: the record celebration is a full-screen, manually
// dismissed overlay (RecordCelebration.vue) — unlike the auto-dismissing
// toast it replaced, it blocks the form underneath until dismissed. Most
// specs here log a first-ever set for a brand-new exercise, which is
// always a new record, so call this after any "Add set" that isn't itself
// testing the celebration (see pr-toast.spec.ts). Waits briefly for the
// background record check (workouts.ts) to resolve; a set that wasn't a
// record just times out here with nothing to dismiss.
export async function dismissCelebrationIfShown(page: Page) {
  const overlay = page.locator('.celebration-overlay')
  try {
    await overlay.waitFor({ state: 'visible', timeout: 2000 })
  } catch {
    return
  }
  await page.getByRole('button', { name: 'Nice!' }).click()
  await overlay.waitFor({ state: 'hidden' })
}
