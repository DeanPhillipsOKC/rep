import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

// Covers docs/backlog.md item 7: rename an existing exercise without
// archiving it, and confirm the new name persists and shows up where the
// exercise is used elsewhere (the workout logging exercise picker).
test('edit exercise name: rename and see it reflected elsewhere', async ({ page }) => {
  const stamp = Date.now()
  const originalName = `E2E Bench Press ${stamp}`
  const renamedName = `E2E Incline Bench Press ${stamp}`

  await signInAsTestUser(page)

  await page.getByRole('button', { name: 'Exercises' }).click()
  await page.getByLabel('Name').fill(originalName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(originalName)).toBeVisible()

  const row = page.locator('.row-wrap', { hasText: originalName })
  await row.getByRole('button', { name: 'Edit name' }).click()
  await row.getByLabel('Name').fill(renamedName)
  await row.getByRole('button', { name: 'Save' }).click()

  await expect(page.locator('.row-wrap', { hasText: renamedName }).locator('.row-title')).toHaveText(
    renamedName,
  )
  await expect(page.getByText(originalName)).not.toBeVisible()

  await page.getByRole('button', { name: 'Log' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(page.getByLabel('Exercise').locator('option', { hasText: renamedName })).toHaveCount(1)
})
