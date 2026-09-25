import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 14: change a template exercise's target set
// count after creation without removing and re-adding it (which would lose
// its position in the routine).
test('edit target set count on a template exercise', async ({ page, stamp }) => {
  const exerciseName = `E2E Incline Press ${stamp}`
  const templateName = `E2E Upper Day ${stamp}`

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
  await page.getByPlaceholder('Sets').fill('3')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  const row = page.locator('.exercise-row-wrap', { hasText: exerciseName })
  await expect(row).toContainText('3 sets')

  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('Target sets').fill('5')
  await row.getByRole('button', { name: 'Save' }).click()

  await expect(row).toContainText('5 sets')
  await expect(row).not.toContainText('3 sets')

  // Editing again then cancelling should discard the draft.
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('Target sets').fill('99')
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).toContainText('5 sets')
})
