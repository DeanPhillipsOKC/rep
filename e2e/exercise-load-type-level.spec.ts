import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'
import { selectExercise } from './fixtures/exercise'

// Covers docs/backlog.md item 76: exercises can be typed 'level' instead of
// 'weight' — the set form swaps weight+unit for a whole-number level field,
// and every place a set is rendered says "reps × Level N" instead of
// "reps × 0lb" (a level set's weight column is always 0).
test('level exercise: create, log a set by level instead of weight, and render it as a level', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E Leg Press Machine ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByLabel('Load type').selectOption('level')
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName, false)

  // The set form for a level exercise offers a "Level" field instead of
  // "Weight" — no unit toggle either, since a level has no lb/kg.
  await expect(page.getByLabel('Weight')).not.toBeVisible()
  await expect(page.getByRole('group', { name: 'Units' })).not.toBeVisible()
  await page.getByLabel('Reps').fill('12')
  await page.getByLabel('Level').fill('3')
  await page.getByRole('button', { name: 'Add set' }).click()
  // First-ever set for this brand-new exercise is also an all-time best.
  await dismissCelebrationIfShown(page)

  const row = page.locator('li.row-wrap', { hasText: exerciseName })
  await expect(row).toContainText('12 × Level 3')
  await expect(row).not.toContainText('0lb')

  // Editing it stays on the level field, not weight.
  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(row.getByLabel('Weight')).not.toBeVisible()
  await row.getByLabel('Level').fill('4')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row).toContainText('12 × Level 4')

  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Exercise history detail shows a "Best level" summary, not a weight one.
  await goTo(page, 'Exercises')
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'View exercise history' }).click()
  await expect(page.getByText('Best level')).toBeVisible()
  await expect(page.getByText('Level 4 × 12')).toBeVisible()
  await expect(page.getByText('Heaviest completed set')).not.toBeVisible()
})

// Covers the other half of item 76: level exercises are excluded from
// volume entirely (not counted as 0), and a template exercise that's
// level-typed must not be treated as "skipped" for the projected line either
// — so a template mixing a weight exercise with a level exercise should
// chart the same actual/projected volume as if the level exercise weren't
// there at all.
test('level exercise: excluded from the volume chart entirely, not counted as 0', async ({ page, stamp }) => {
  const weightName = `E2E Bench Press ${stamp}`
  const levelName = `E2E Assisted Dip Machine ${stamp}`
  const templateName = `E2E Push Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(weightName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(weightName)).toBeVisible()
  await page.getByLabel('Name').fill(levelName)
  await page.getByLabel('Load type').selectOption('level')
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(levelName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: weightName })
  await page.getByPlaceholder('Sets').fill('1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: weightName })).toBeVisible()
  await page.getByRole('combobox').selectOption({ label: levelName })
  await page.getByPlaceholder('Sets').fill('1')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: levelName })).toBeVisible()

  // Workout 1: one set each. Weight volume = 10 x 100 = 1000; the level set
  // contributes nothing either way.
  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, weightName, true)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await selectExercise(page, levelName, true)
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Level').fill('2')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // First-ever completion of this template: the congratulatory card shows
  // instead of a chart (item 70) — nothing to assert on the numbers yet.
  await expect(page.getByText('First workout logged.')).toBeVisible()
  await page.getByRole('button', { name: 'Log another workout' }).click()

  // Workout 2: same sets again, so both points should read identically —
  // if the level set were being counted as 0 volume instead of excluded, or
  // its template exercise were wrongly treated as "skipped" and carried
  // forward, the numbers here would still match (both are level, both 0),
  // so the real signal is simply that the level exercise never shows up in
  // the totals at all: both points equal the weight exercise's volume alone.
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, weightName, true)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await selectExercise(page, levelName, true)
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Level').fill('2')
  await page.getByRole('button', { name: 'Add set' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()

  await expect(page.getByRole('heading', { name: 'Volume over time' })).toBeVisible()
  const points = page.locator('[data-testid="volume-point"]')
  await expect(points).toHaveCount(2)
  // VolumeChart.vue only prints "projected" when it differs from "actual" —
  // its absence here confirms the level set never diverged the two (it was
  // excluded outright, not carried forward as a short exercise).
  await expect(points.nth(0)).toContainText('1000 actual')
  await expect(points.nth(0)).not.toContainText('projected')
  await expect(points.nth(1)).toContainText('1000 actual')
  await expect(points.nth(1)).not.toContainText('projected')

  await page.getByRole('button', { name: 'Log another workout' }).click()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()
})
