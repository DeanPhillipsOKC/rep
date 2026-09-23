import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

// Covers docs/backlog.md item 3: starting a new workout against a template
// that already has a logged instance shows a "Last time" card and pre-fills
// the reps/weight fields from the most recent matching set.
test('pre-fill: last workout of the same template surfaces on the next one', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Squat ${stamp}`
  const templateName = `E2E Leg Day ${stamp}`

  await signInAsTestUser(page)

  await page.getByRole('button', { name: 'Exercises' }).click()
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await page.getByRole('button', { name: 'Templates' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row', { hasText: exerciseName })).toBeVisible()

  // First workout against the template: log one set, then finish.
  await page.getByRole('button', { name: 'Log' }).click()
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('185')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: exerciseName })).toBeVisible()
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Second workout against the same template: should show last time's data.
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()

  await expect(page.locator('.last-time', { hasText: exerciseName })).toContainText('8×185lb')

  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(page.getByLabel('Reps')).toHaveValue('8')
  await expect(page.getByLabel('Weight')).toHaveValue('185')
})
