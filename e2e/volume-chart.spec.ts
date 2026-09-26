import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'
import { selectExercise } from './fixtures/exercise'

// Covers docs/backlog.md item 6: post-workout volume-over-time chart, shown
// after finishing any workout logged against a template. Template has two
// exercises: `trackedName` (target_sets: 2) and `otherName` (no target —
// "complete" as soon as it has any sets, per computeVolumeHistory). First
// workout completes both (actual == projected). Second workout logs only
// one set of `trackedName` (under its target) plus one of `otherName` (still
// complete) — `otherName` also keeps the workout from tripping the
// zero-set cleanup (item 9), though `trackedName`'s own set already would.
// That instance's projected volume should carry forward `trackedName`'s
// volume from its last complete appearance instead of using this instance's
// partial number, while `otherName`'s literal actual passes straight
// through since it's complete. Both exercises have to be on the template —
// item 21 scoped the in-workout exercise picker to the active template, so
// an untracked exercise can no longer be logged against one at all.
test('volume chart: under-completed exercise carries forward its last complete volume', async ({ page, stamp }) => {
  const trackedName = `E2E Squat ${stamp}`
  const otherName = `E2E Curl ${stamp}`
  const templateName = `E2E Leg Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(trackedName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(trackedName)).toBeVisible()
  await page.getByLabel('Name').fill(otherName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(otherName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: trackedName })
  await page.getByPlaceholder('Sets').fill('2')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: trackedName })).toBeVisible()
  await page.getByRole('combobox').selectOption({ label: otherName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: otherName })).toBeVisible()

  // Workout 1: complete both sets of the tracked exercise. Volume = 2000.
  // target_sets: 2 means both rows show up together (backlog item 1), so
  // each fill/log is scoped to the first still-open row rather than an
  // unscoped Reps/Weight lookup, which would otherwise match both rows at
  // once and fail with a strict-mode violation.
  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, trackedName, true)
  await expect(page.locator('.set-row-draft')).toHaveCount(2)
  let openRow = page.locator('.set-row-draft').first()
  await openRow.getByLabel('Reps').fill('10')
  await openRow.getByLabel('Weight').fill('100')
  await openRow.getByRole('button', { name: 'Add set' }).click()
  // First-ever set for this brand-new exercise is also an all-time best.
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(1)
  await expect(page.locator('.set-row-draft')).toHaveCount(1)
  openRow = page.locator('.set-row-draft').first()
  await openRow.getByLabel('Reps').fill('10')
  await openRow.getByLabel('Weight').fill('100')
  await openRow.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(2)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Item 70: the first time a template is ever completed, volumeHistory has
  // only one point — nothing to show "over time" — so a congratulatory card
  // shows in the chart's slot instead of a single-dot chart.
  await expect(page.getByText('First workout logged.')).toBeVisible()
  await expect(page.getByText('Track your volume over time as you complete more workouts.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Volume over time' })).not.toBeVisible()
  await expect(page.locator('[data-testid="volume-point"]')).toHaveCount(0)

  // Item 68: "Log another workout" goes straight to the normal start screen
  // now, no second "Resume your workout?" gate in the way.
  await page.getByRole('button', { name: 'Log another workout' }).click()

  // Workout 2: only one set of the tracked exercise (under target_sets: 2),
  // volume 500 — plus one set of `otherName` (no target_sets, so it's
  // "complete" and its actual volume passes straight through, uncarried).
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, trackedName, true)
  await expect(page.locator('.set-row-draft')).toHaveCount(2)
  await page.locator('.set-row-draft').first().getByLabel('Reps').fill('10')
  await page.locator('.set-row-draft').first().getByLabel('Weight').fill('50')
  await page.locator('.set-row-draft').first().getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: trackedName })).toHaveCount(1)
  await selectExercise(page, otherName, true)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('20')
  await page.getByRole('button', { name: 'Add set' }).click()
  // First-ever set for otherName is also an all-time best.
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.row', { hasText: otherName })).toHaveCount(1)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Two points now, so the real chart shows instead of the item 70 card.
  await expect(page.getByRole('heading', { name: 'Volume over time' })).toBeVisible()
  const points = page.locator('[data-testid="volume-point"]')
  await expect(points).toHaveCount(2)
  // Workout 2: actual is the literal (partial) volume logged; projected
  // carries forward the tracked exercise's complete volume from workout 1
  // (2000) in place of its partial contribution (500), plus `otherName`'s
  // 200 both ways (it's complete, so it isn't carried): 200 + 2000 = 2200.
  await expect(points.nth(1)).toContainText('700 actual')
  await expect(points.nth(1)).toContainText('2200 projected')

  // Item 53: the chart explains what "Projected" means and labels the axis
  // with a unit — both sets in this spec are logged in the default 'lb'
  // unit (WorkoutLogger.vue's weightUnit ref).
  await expect(page.getByText(/Projected volume \(lb\) carries forward/)).toBeVisible()
  await expect(page.getByRole('img', { name: 'Volume over time, in lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Log another workout' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
})
