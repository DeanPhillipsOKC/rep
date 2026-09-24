import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

// Covers docs/backlog.md item 6: post-workout volume-over-time chart, shown
// after finishing any workout logged against a template. Template's
// exercise has target_sets: 2. First workout completes both sets (actual ==
// projected). Second workout logs only one set of it (under the target)
// plus a set of an untracked exercise so the workout survives the
// zero-set cleanup (item 9) — that instance's projected volume should carry
// forward the exercise's volume from its last complete appearance instead of
// using this instance's partial number.
test('volume chart: under-completed exercise carries forward its last complete volume', async ({ page }) => {
  const stamp = Date.now()
  const trackedName = `E2E Squat ${stamp}`
  const otherName = `E2E Curl ${stamp}`
  const templateName = `E2E Leg Day ${stamp}`

  await signInAsTestUser(page)

  await page.getByRole('button', { name: 'Exercises' }).click()
  await page.getByLabel('Name').fill(trackedName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(trackedName)).toBeVisible()
  await page.getByLabel('Name').fill(otherName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(otherName)).toBeVisible()

  await page.getByRole('button', { name: 'Templates' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: trackedName })
  await page.getByPlaceholder('Sets').fill('2')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: trackedName })).toBeVisible()

  // Workout 1: complete both sets of the tracked exercise. Volume = 2000.
  // Each add is followed by a wait for its row to land before the next fill
  // — a successful add clears reps/weight back to null (no prior workout to
  // pre-fill from, see WorkoutLogger.vue's applyPrefill), so filling ahead
  // of that landing risks the next fill being wiped out from under it.
  await page.getByRole('button', { name: 'Log' }).click()
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: trackedName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(1)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(2)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Chart shows after every finished templated workout, not only when a gap
  // exists. First-ever point: complete, actual == projected.
  let points = page.locator('[data-testid="volume-point"]')
  await expect(points).toHaveCount(1)
  await expect(points.nth(0)).toContainText('2000 actual')
  await expect(points.nth(0)).not.toContainText('projected')

  await page.getByRole('button', { name: 'Log another workout' }).click()

  // Workout 2: only one set of the tracked exercise (under target_sets: 2),
  // volume 500 — plus one set of the untracked exercise so this workout
  // isn't deleted as empty.
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: trackedName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('50')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(1)
  await page.getByLabel('Exercise').selectOption({ label: otherName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('20')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: otherName })).toHaveCount(1)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  points = page.locator('[data-testid="volume-point"]')
  await expect(points).toHaveCount(2)
  // Workout 2: actual is the literal (partial) volume logged; projected
  // carries forward the tracked exercise's complete volume from workout 1
  // (2000) in place of its partial contribution (500), plus the untracked
  // exercise's 200 both ways: 200 (other, actual) + 2000 (carried) = 2200.
  await expect(points.nth(1)).toContainText('700 actual')
  await expect(points.nth(1)).toContainText('2200 projected')

  await page.getByRole('button', { name: 'Log another workout' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
})
