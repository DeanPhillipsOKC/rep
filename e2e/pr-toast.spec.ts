import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { selectExercise } from './fixtures/exercise'

// Covers docs/backlog.md item 38 (the full-screen celebration takeover) and
// docs/backlog-archive.md item 4 (the underlying record detection it
// replaced the toast for): adding a set that beats the user's all-time best
// (reps * weight) for that exercise shows a congratulatory, manually
// dismissed takeover. The comparison is per-exercise across all past
// workouts, not scoped to the current workout or template.
test('Record celebration: shows on a new all-time best, blocks until dismissed, and stays quiet otherwise', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E Overhead Press ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName)

  // First-ever set for this exercise: any value is a new best.
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('100')
  await page.getByRole('button', { name: 'Add set' }).click()
  const celebration = page.getByRole('dialog', { name: `New record: ${exerciseName}` })
  await expect(celebration).toBeVisible()
  await expect(celebration).toContainText(exerciseName)
  await expect(celebration).toContainText('100 lb × 8')
  await expect(celebration).toContainText('First one logged for this exercise')

  await page.getByRole('button', { name: 'Nice!' }).click()
  await expect(celebration).not.toBeVisible()

  // A lighter set (lower volume) should not retrigger the celebration.
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('90')
  await page.getByRole('button', { name: 'Add set' }).click()
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)

  // A heavier set beats the all-time best again, this time showing the
  // delta over the prior best rather than "first one logged".
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('110')
  await page.getByRole('button', { name: 'Add set' }).click()
  await expect(celebration).toBeVisible()
  await expect(celebration).toContainText('+80 lb-reps of volume over your last best')
  await page.getByRole('button', { name: 'Nice!' }).click()
  await expect(celebration).not.toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()

  // A later workout: matching (not beating) the prior best must not trigger.
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName)
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('110')
  await page.getByRole('button', { name: 'Add set' }).click()
  await page.waitForTimeout(500)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

// Dismissing via a tap on the overlay itself (not just the "Nice!" button)
// matches the approved mockup's "tap anywhere to dismiss" affordance.
test('Record celebration: tapping the overlay also dismisses it', async ({ page, stamp }) => {
  const exerciseName = `E2E Incline Press ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName)
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('50')
  await page.getByRole('button', { name: 'Add set' }).click()

  const celebration = page.getByRole('dialog', { name: `New record: ${exerciseName}` })
  await expect(celebration).toBeVisible()
  await celebration.click({ position: { x: 5, y: 5 } })
  await expect(celebration).not.toBeVisible()
})
