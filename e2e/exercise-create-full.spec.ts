import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 22: setup notes and rest timer can be set on
// the create form itself, without the forced round-trip through the
// per-row editors (e2e/exercise-notes.spec.ts, e2e/rest-timer.spec.ts).
test('create exercise: name, notes, and rest timer in one step', async ({ page, stamp }) => {
  const exerciseName = `E2E Cable Row ${stamp}`
  const notes = 'Seat forward 2, wide grip'

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByLabel('Setup notes').fill(notes)
  await page.getByLabel('Rest timer (seconds)').fill('60')
  await page.getByRole('button', { name: 'Add exercise' }).click()

  const row = page.locator('.row-wrap', { hasText: exerciseName })
  await expect(row.locator('.tag-pill', { hasText: notes })).toBeVisible()
  await expect(row.locator('.tag-pill', { hasText: 'Rest: 60s' })).toBeVisible()

  // The consolidated edit flyout opens pre-filled with what the create form
  // already set, rather than needing a separate add-then-edit round trip.
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await expect(row.getByLabel('Setup notes')).toHaveValue(notes)
  await expect(row.getByLabel('Rest timer (seconds)')).toHaveValue('60')
})
