import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 35: archiving a template used to fire
// immediately on click with no way back — this checks the inline confirm
// step (same pattern as WorkoutHistory.vue's workout delete) both cancels
// without archiving and, once confirmed, actually archives.
test('archiving a template requires an explicit confirm step', async ({ page, stamp }) => {
  const templateName = `E2E Archive Confirm ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await expect(page.getByText(templateName)).toBeVisible()

  // Grabbed positionally (createTemplate pushes onto the end of the list)
  // rather than via `hasText: templateName`, since the confirm step swaps
  // the template's name out of the row entirely — a hasText filter would
  // stop matching the instant the confirm UI appears.
  const row = page.locator('.row-wrap').last()
  await row.getByRole('button', { name: 'Archive' }).click()
  await expect(row.getByText("Archive this template? This can't be undone.")).toBeVisible()

  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(templateName)).toBeVisible()
  await expect(row.getByRole('button', { name: 'Archive' })).toBeVisible()

  await row.getByRole('button', { name: 'Archive' }).click()
  await row.getByRole('button', { name: 'Confirm archive' }).click()
  await expect(page.getByText(templateName)).toHaveCount(0)
})
