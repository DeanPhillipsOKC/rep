import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 24: "Archive" (no restore path anywhere in the
// UI) is relabeled "Delete" and now requires an explicit confirm step,
// same inline-toggle pattern as e2e/template-archive-confirm.spec.ts.
test('deleting an exercise requires an explicit confirm step', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Delete Confirm ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  // The confirm step swaps the exercise's name out of the row entirely, so
  // "Confirm delete"/"Cancel" are queried directly rather than staying
  // scoped to a `hasText: exerciseName` locator that stops matching the
  // instant the confirm UI appears (same shape as the template-archive spec).
  await page.locator('.row-wrap', { hasText: exerciseName }).getByRole('button', { name: 'Delete exercise' }).click()
  await expect(page.getByText("Delete this exercise? This can't be undone.")).toBeVisible()

  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await page.locator('.row-wrap', { hasText: exerciseName }).getByRole('button', { name: 'Delete exercise' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByText(exerciseName)).toHaveCount(0)
})
