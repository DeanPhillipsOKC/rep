import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 2 (workout templates): create a template,
// attach an exercise to it, start a workout against it, and confirm the
// template surfaces as a suggestion during logging and as a tag in history.
test('templates: create, log a workout against one, and see it in history', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Bench ${stamp}`
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

  await goTo(page, 'Log')
  await page.getByLabel('Template (optional)').selectOption({ label: templateName })
  await page.getByRole('button', { name: 'Start workout' }).click()

  const chip = page.getByRole('button', { name: exerciseName, exact: true })
  await expect(chip).toBeVisible()
  await chip.click()

  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('135')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.row', { hasText: exerciseName })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()

  await goTo(page, 'History')
  await expect(page.locator('.template-tag').first()).toHaveText(templateName)
})
