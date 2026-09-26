import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'
import { selectExercise } from './fixtures/exercise'

// This spec predates the "resume after finish" item (docs/backlog-archive.md,
// "Let an accidentally-finished workout be resumed..."): finishing a freeform
// workout with at least one set now shows a "Resume your workout?" card
// immediately, covering the whole Home screen — including the progress strip
// this spec reads — until dismissed. Two earlier next-item runs hit exactly
// this and misdiagnosed it as the already-tracked shared-account row-leak
// flake (matching counts only by coincidence, since both grow over time);
// it's really this card, confirmed by reproducing with diagnostics that
// showed the stat tile disappearing from the DOM entirely once the card
// finishes rendering. Non-destructively dismissed below via "Start a new
// workout", the same button e2e/resume-after-finish.spec.ts's freeform case
// uses.

// Covers docs/backlog.md item 19: Log home screen's progress strip. Reads
// the "workouts this week" tile before/after so the test doesn't depend on
// the shared test account's pre-existing count (other specs also log
// workouts). Tests run with a single worker (playwright.config.ts), so no
// other spec can log a workout between this test's before/after reads.
test('progress strip: workouts-this-week count and recent-PR tile update after finishing a workout', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E Deadlift ${stamp}`

  const admin = getAdminClient()

  // The progress strip and the start-workout form both only render once the
  // account has at least one active exercise (docs/backlog-archive.md item
  // 27's zero-exercise welcome card) — seed a throwaway one directly via the
  // admin client (item 57's pattern) so this test's own before/after tile
  // reads aren't gated behind creating `exerciseName` first. Seeded via
  // signInAsTestUser's beforeNavigate hook (rather than seed-then-reload) so
  // there's only ever one onMounted fetchProgressStats() call — two calls
  // across two mounts can resolve out of order and silently overwrite the
  // fresher "this week" count with the stale one, which is exactly what
  // broke this test's own before/after comparison the first time this fix
  // was tried with a reload (docs/backlog.md item 58).
  await signInAsTestUser(page, {
    beforeNavigate: async (userId) => {
      await admin.from('exercises').insert({ user_id: userId, name: `E2E Baseline ${stamp}` })
    },
  })

  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
  // fetchProgressStats() (workouts.ts) runs in the background from onMounted
  // alongside the exercises/templates fetches — wait for it to land instead
  // of racing the stat tile's initial `0` placeholder.
  await page.waitForLoadState('networkidle')

  const weekCountBefore = Number(await page.locator('.stat-tile').first().locator('.stat-value').textContent())

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName)
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('135')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.row', { hasText: exerciseName })).toHaveCount(1)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Freeform + at least one set means the "Resume your workout?" offer
  // appears right away, covering the progress strip until dismissed.
  await expect(page.locator('.card', { hasText: 'Resume your workout?' })).toBeVisible()
  await page.getByRole('button', { name: 'Start a new workout' }).click()

  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
  await expect(page.locator('.stat-tile').first().locator('.stat-value')).toHaveText(String(weekCountBefore + 1))

  // First-ever set for this exercise is an all-time best, so it's this
  // workout's (and therefore the strip's) recent PR.
  await expect(page.locator('.stat-tile-pr .stat-label')).toHaveText(exerciseName)
})
