import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 22: setup notes and rest timer can be set on
// the create form itself, without the forced round-trip through the
// per-row editors (e2e/exercise-notes.spec.ts, e2e/rest-timer.spec.ts).
test('create exercise: name, notes, and rest timer in one step', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Cable Row ${stamp}`
  const notes = 'Seat forward 2, wide grip'

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByLabel('Setup notes').fill(notes)
  await page.getByLabel('Rest timer (seconds)').fill('60')
  await page.getByRole('button', { name: 'Add exercise' }).click()

  const row = page.locator('.row-wrap', { hasText: exerciseName })
  await expect(row.locator('.row-notes')).toHaveText(notes)
  await expect(row.locator('.row-sub', { hasText: 'Rest: 60s' })).toBeVisible()

  // Per-row editors show "Edit", not "Add", since the create form already
  // set these values.
  await expect(row.getByRole('button', { name: 'Edit notes' })).toBeVisible()
  await expect(row.getByRole('button', { name: 'Edit rest timer' })).toBeVisible()
})
