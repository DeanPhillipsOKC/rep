import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

// Covers docs/backlog.md item 3: starting a new workout against a template
// that already has a logged instance shows a "Last time" card and pre-fills
// the reps/weight fields from the most recent matching set. Also covers the
// "Last time" card narrowing to the selected exercise once one is picked,
// so a multi-exercise template doesn't force scrolling mid-workout.
test('pre-fill: last workout of the same template surfaces on the next one', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Squat ${stamp}`
  const otherExerciseName = `E2E Deadlift ${stamp}`
  const templateName = `E2E Leg Day ${stamp}`

  await signInAsTestUser(page)

  await page.getByRole('button', { name: 'Exercises' }).click()
  for (const name of [exerciseName, otherExerciseName]) {
    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(page.getByText(name)).toBeVisible()
  }

  await page.getByRole('button', { name: 'Templates' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  for (const name of [exerciseName, otherExerciseName]) {
    await page.getByRole('combobox').selectOption({ label: name })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.exercise-row', { hasText: name })).toBeVisible()
  }

  // First workout against the template: log a set for each exercise, then finish.
  await page.getByRole('button', { name: 'Log' }).click()
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('185')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: exerciseName })).toBeVisible()
  await page.getByRole('button', { name: otherExerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('225')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: otherExerciseName })).toBeVisible()
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Second workout against the same template, but abandoned with no sets
  // logged (e.g. started by mistake). This must not shadow the real data
  // from the first workout on the next lookup.
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Third workout against the same template: should show the last workout
  // that actually had sets (the first one), skipping the empty one.
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()

  const lastTime = page.locator('.last-time')
  await expect(lastTime).toContainText(exerciseName)
  await expect(lastTime).toContainText(otherExerciseName)
  await expect(lastTime).toContainText('8×185lb')
  await expect(lastTime).toContainText('5×225lb')

  // Picking an exercise narrows the card to just that exercise.
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(lastTime).toContainText(exerciseName)
  await expect(lastTime).not.toContainText(otherExerciseName)
  await expect(page.getByLabel('Reps')).toHaveValue('8')
  await expect(page.getByLabel('Weight')).toHaveValue('185')

  // Switching exercises re-narrows rather than staying stuck on the first pick.
  await page.getByRole('button', { name: otherExerciseName, exact: true }).click()
  await expect(lastTime).toContainText(otherExerciseName)
  await expect(lastTime).not.toContainText(exerciseName)
  await expect(page.getByLabel('Reps')).toHaveValue('5')
  await expect(page.getByLabel('Weight')).toHaveValue('225')
})
