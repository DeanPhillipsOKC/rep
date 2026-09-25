import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md item 31: remove a finished workout logged in error
// from History. `sets.workout_id` has `on delete cascade`, so this also
// confirms the workout row itself is actually gone, not just hidden.
test('delete a workout from History', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Delete Workout ${stamp}`
  const notes = `E2E delete-workout ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Log')
  await page.getByLabel('Notes (optional)').fill(notes)
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  await goTo(page, 'History')
  const card = page.locator('.card', { hasText: notes })
  await expect(card).toBeVisible()

  // Clicking the delete icon shows a confirm step rather than deleting immediately.
  await card.getByRole('button', { name: 'Delete workout' }).click()
  await expect(card.getByText("Delete this workout? This can't be undone.")).toBeVisible()

  // Cancelling backs out without deleting.
  await card.getByRole('button', { name: 'Cancel' }).click()
  await expect(card).toBeVisible()

  await card.getByRole('button', { name: 'Delete workout' }).click()
  await card.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.locator('.card', { hasText: notes })).toHaveCount(0)

  const admin = getAdminClient()
  const { data, error } = await admin.from('workouts').select('id').eq('notes', notes)
  expect(error).toBeNull()
  expect(data).toEqual([])
})
