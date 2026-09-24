import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 25: archiving an exercise only flips
// exercises.is_archived, it never touches workout_template_exercises, so an
// archived exercise attached to a template kept surfacing as a suggested
// chip and a loggable dropdown option every time that template was used.
test('archived exercise stops appearing in a template it is still attached to', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Archived ${stamp}`
  const templateName = `E2E Push Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row', { hasText: exerciseName })).toBeVisible()

  await goTo(page, 'Exercises')
  await page
    .locator('li', { hasText: exerciseName })
    .getByRole('button', { name: 'Archive' })
    .click()
  await expect(page.getByText(exerciseName)).toHaveCount(0)

  // Back on Templates, in the same session: templates.exercisesByTemplate
  // was already cached from expanding this template earlier, and only ever
  // fetches once per template per session — so this checks the "Archived"
  // tag against exactly that stale cache, not a freshly re-fetched join.
  await goTo(page, 'Templates')
  await page.getByText(templateName).click()
  const templateExerciseRow = page.locator('.exercise-row', { hasText: exerciseName })
  await expect(templateExerciseRow.getByText('Archived')).toBeVisible()

  await goTo(page, 'Log')
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()

  // Wait for the suggested-chips section to actually mount before checking
  // what it offers — asserting toHaveCount(0) against a section that hasn't
  // rendered yet (activeWorkoutId/activeTemplateId still settling after the
  // start-workout request) trivially "passes" without ever having checked
  // the real, post-render list. Waiting on the container itself rather than
  // e.g. the "Add set" button, since with only one (now-excluded) exercise
  // on this template the picker legitimately has nothing to auto-select.
  await page.locator('.suggested').waitFor({ state: 'attached' })

  await expect(page.locator('.suggested .chip', { hasText: exerciseName })).toHaveCount(0)
  await expect(page.getByLabel('Exercise').getByRole('option', { name: exerciseName })).toHaveCount(0)
})
