import type { Page } from '@playwright/test'

// Item 67: exercise selection in the active-workout screen moved from a
// suggested-chip row + <select> dropdown to a swipeable carousel. An
// exercise already in the carousel deck (a templated workout's own
// exercises, or one already added this session) is picked by its dot, which
// carries the exercise's name as its accessible name -- same as the old
// suggested chip did, so `getByRole('button', { name, exact: true })` still
// works unchanged for those. An exercise not yet in the deck (freeform, or
// an ad-hoc addition to a templated workout) is added through the "Add
// exercise" sheet first.
export async function selectExercise(page: Page, name: string) {
  // A templated workout's carousel auto-selects its first exercise as soon
  // as `handleStart`/`handleResume` finish (WorkoutLogger.vue), which can
  // still be in flight right after a "Start workout" click resolves -- a
  // plain `.count()` snapshot would race that and wrongly conclude the dot
  // doesn't exist yet. `waitFor` retries instead, same short-timeout-then-
  // fall-back shape as `dismissCelebrationIfShown` (fixtures/celebration.ts).
  const existing = page.getByRole('button', { name, exact: true })
  try {
    await existing.waitFor({ state: 'visible', timeout: 2000 })
    await existing.click()
    return
  } catch {
    // Not in the deck -- add it through the sheet instead.
  }
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByPlaceholder('Search exercises').fill(name)
  await page.getByRole('button', { name, exact: true }).click()
}
