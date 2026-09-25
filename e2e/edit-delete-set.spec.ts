import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md item 13: fix or remove a set logged in error while
// a workout is still in progress, without having to finish and re-log.
test('edit and delete a set in an active workout', async ({ page, stamp }) => {
  const exerciseName = `E2E Overhead Press ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  const row = page.locator('li.row-wrap', { hasText: exerciseName })
  await expect(row).toBeVisible()
  await expect(row).toContainText('10 × 45lb')

  // Fix a fat-fingered entry.
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('Reps').fill('8')
  await row.getByLabel('Weight').fill('50')
  await row.getByRole('button', { name: 'Save' }).click()

  await expect(row).toContainText('8 × 50lb')
  await expect(row).not.toContainText('10 × 45lb')

  // Editing again then cancelling should discard the draft.
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('Reps').fill('99')
  await row.getByRole('button', { name: 'Cancel' }).click()
  await expect(row).toContainText('8 × 50lb')

  // Remove the set logged in error — backlog item 51 requires a confirm
  // step before the delete actually happens.
  await row.getByRole('button', { name: 'Delete' }).click()
  await row.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.locator('li.row-wrap', { hasText: exerciseName })).toHaveCount(0)
})
