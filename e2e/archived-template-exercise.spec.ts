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

  await goTo(page, 'Log')
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()

  await expect(page.locator('.suggested .chip', { hasText: exerciseName })).toHaveCount(0)
  await expect(page.getByLabel('Exercise').getByRole('option', { name: exerciseName })).toHaveCount(0)
})
