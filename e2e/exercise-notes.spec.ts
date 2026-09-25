import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 8: add setup notes to an exercise, confirm
// they persist in the Exercises tab, and confirm they surface next to the
// set-entry form while logging a workout (not just in the Exercises tab).
test('exercise setup notes: add, edit, and see them while logging', async ({ page, stamp }) => {
  const exerciseName = `E2E Leg Press ${stamp}`
  const initialNotes = 'Seat position 4, back pad 2'
  const updatedNotes = 'Seat position 5, back pad 2'

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  const row = page.locator('.row-wrap', { hasText: exerciseName })
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await row.getByLabel('Setup notes').fill(initialNotes)
  await row.getByRole('button', { name: 'Save' }).click()

  await expect(row.locator('.tag-pill')).toHaveText(initialNotes)

  // Edit persists correctly, not just create.
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await row.getByLabel('Setup notes').fill(updatedNotes)
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.locator('.tag-pill')).toHaveText(updatedNotes)

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  await expect(page.locator('.setup-notes')).toHaveText(updatedNotes)
})
