import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md item 32: fix a wrong rep/weight/RPE entry, remove a
// set, or edit the notes on a workout that's already finished, without
// having to delete the whole thing (item 31) and re-log it. Scoped to sets
// that already exist on the workout — adding a brand-new set to a finished
// workout is out of scope for this item.
test('edit notes and a set, and delete a set, on a past workout in History', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Edit Past Workout ${stamp}`
  const notes = `E2E edit-past-workout ${stamp}`
  const updatedNotes = `${notes} (fixed)`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByLabel('Notes (optional)').fill(notes)
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('135')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  await page.getByRole('button', { name: 'Finish workout' }).click()

  await goTo(page, 'History')
  // exerciseName is unique to this test run and untouched by the notes edit
  // below, so it stays a stable way to find this workout's card throughout.
  const card = page.locator('.card', { hasText: exerciseName })
  await expect(card).toBeVisible()
  await expect(card.getByText(notes, { exact: true })).toBeVisible()

  // Fix a wrong note.
  await card.getByRole('button', { name: 'Edit notes' }).click()
  await card.getByLabel('Notes').fill(updatedNotes)
  await card.getByRole('button', { name: 'Save' }).click()
  await expect(card.getByText(updatedNotes, { exact: true })).toBeVisible()
  await expect(card.getByText(notes, { exact: true })).toHaveCount(0)

  // Fix a fat-fingered entry on the first set (set_index 0, so the first
  // row in list order) — re-locate by position rather than by its old
  // reps/weight text, since that text is exactly what this edit changes.
  const firstSetRow = card.locator('li.row-wrap').first()
  await expect(firstSetRow).toContainText('10 × 45lb')
  await firstSetRow.getByRole('button', { name: 'Edit' }).click()
  await firstSetRow.getByLabel('Reps').fill('12')
  await firstSetRow.getByLabel('Weight').fill('50')
  await firstSetRow.getByRole('button', { name: 'Save' }).click()
  await expect(firstSetRow).toContainText('12 × 50lb')

  // Editing again then cancelling should discard the draft.
  await firstSetRow.getByRole('button', { name: 'Edit' }).click()
  await firstSetRow.getByLabel('Reps').fill('99')
  await firstSetRow.getByRole('button', { name: 'Cancel' }).click()
  await expect(firstSetRow).toContainText('12 × 50lb')

  // Remove the second set logged in error — the workout itself (and its
  // other set) should still be there afterward, unlike deleting the whole
  // workout (item 31).
  const secondSetRow = card.locator('li.row-wrap').nth(1)
  await expect(secondSetRow).toContainText('8 × 135lb')
  await secondSetRow.getByRole('button', { name: 'Delete' }).click()
  await secondSetRow.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(card.locator('li.row-wrap')).toHaveCount(1)
  await expect(card).toBeVisible()
  await expect(firstSetRow).toContainText('12 × 50lb')
})
