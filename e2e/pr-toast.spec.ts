import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 4: adding a set that beats the user's all-time
// best (reps * weight) for that exercise shows a congratulatory toast. The
// comparison is per-exercise across all past workouts, not scoped to the
// current workout or template.
test('PR toast: shows on a new all-time best and stays quiet otherwise', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Overhead Press ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Log')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  // First-ever set for this exercise: any value is a new best.
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.record-toast')).toContainText(`New record: ${exerciseName}`)

  // A lighter set (lower volume) should not retrigger the toast.
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('90')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.record-toast')).toHaveCount(0)

  // A heavier set beats the all-time best again.
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('110')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.record-toast')).toContainText(`New record: ${exerciseName}`)

  await page.getByRole('button', { name: 'Finish workout' }).click()

  // A later workout: matching (not beating) the prior best must not trigger.
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('110')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(page.locator('.record-toast')).toHaveCount(0)
})
