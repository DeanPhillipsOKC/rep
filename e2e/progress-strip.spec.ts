import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md item 19: Log home screen's progress strip. Reads
// the "workouts this week" tile before/after so the test doesn't depend on
// the shared test account's pre-existing count (other specs also log
// workouts). Tests run with a single worker (playwright.config.ts), so no
// other spec can log a workout between this test's before/after reads.
test('progress strip: workouts-this-week count and recent-PR tile update after finishing a workout', async ({
  page,
}) => {
  const stamp = Date.now()
  const exerciseName = `E2E Deadlift ${stamp}`

  await signInAsTestUser(page)
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

  await goTo(page, 'Log')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('135')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.row', { hasText: exerciseName })).toHaveCount(1)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
  await expect(page.locator('.stat-tile').first().locator('.stat-value')).toHaveText(String(weekCountBefore + 1))

  // First-ever set for this exercise is an all-time best, so it's this
  // workout's (and therefore the strip's) recent PR.
  await expect(page.locator('.stat-tile-pr .stat-label')).toHaveText(exerciseName)
})
