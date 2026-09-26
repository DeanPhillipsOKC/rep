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
//
// `inDeck`, when the caller already knows the answer, skips the race
// entirely instead of guessing (item 82): a freeform workout's deck always
// starts empty, so callers right after "Freeform" + "Start workout" can pass
// `false` and go straight to the sheet with no wait at all; a templated
// workout's own exercise (or one already added earlier this session) is
// already there, so callers can pass `true` and assert it's visible instead
// of racing a fallback. Omit it when the caller genuinely doesn't know --
// this keeps today's guess-then-fall-back behavior.
export async function selectExercise(page: Page, name: string, inDeck?: boolean) {
  if (inDeck === false) {
    await addExerciseViaSheet(page, name)
    return
  }

  const existing = page.getByRole('button', { name, exact: true })
  if (inDeck === true) {
    await existing.waitFor({ state: 'visible' })
    await existing.click()
    return
  }

  // Unknown which case applies -- a templated workout's carousel
  // auto-selects its first exercise as soon as `handleStart`/`handleResume`
  // finish (WorkoutLogger.vue), which can still be in flight right after a
  // "Start workout" click resolves, so a plain `.count()` snapshot would
  // race that and wrongly conclude the dot doesn't exist yet. `waitFor`
  // retries instead, same short-timeout-then-fall-back shape as
  // `dismissCelebrationIfShown` (fixtures/celebration.ts).
  try {
    await existing.waitFor({ state: 'visible', timeout: 2000 })
    await existing.click()
    return
  } catch {
    // Not in the deck -- add it through the sheet instead.
  }
  await addExerciseViaSheet(page, name)
}

async function addExerciseViaSheet(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await page.getByPlaceholder('Search exercises').fill(name)
  await page.getByRole('button', { name, exact: true }).click()
}
