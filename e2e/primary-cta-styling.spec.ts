import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'
import { selectExercise } from './fixtures/exercise'

// Covers docs/backlog.md's "primary calls to action get lost against
// secondary/ghost buttons" item: WorkoutLogger.vue's "Finish workout" and
// post-finish "Log another workout" CTAs were styled `.ghost` (muted,
// transparent) instead of the accent fill every other primary action uses.
// Both now use the shared `.btn-accent` class from style.css. Asserting the
// class list (not computed color) keeps this robust to palette tweaks while
// still catching a regression back to `.ghost` or a plain unstyled button.
test('primary workout CTAs use the accent fill, not the ghost style', async ({ page, stamp }) => {
  const exerciseName = `E2E CTA Style ${stamp}`
  const templateName = `E2E CTA Style Template ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: exerciseName })).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName, true)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.row', { hasText: exerciseName })).toHaveCount(1)

  const finishButton = page.getByRole('button', { name: 'Finish workout' })
  await expect(finishButton).toHaveClass(/btn-accent/)
  await expect(finishButton).not.toHaveClass(/ghost/)
  await finishButton.click()

  const logAnotherButton = page.getByRole('button', { name: 'Log another workout' })
  await expect(logAnotherButton).toHaveClass(/btn-accent/)
  await expect(logAnotherButton).not.toHaveClass(/ghost/)
})
