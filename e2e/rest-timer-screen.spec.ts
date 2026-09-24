import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 28: the in-app rest screen (RestTimer.vue)
// shown after logging a set for an exercise with rest_seconds configured.
// Distinct from item 15's push notification, which e2e/rest-timer.spec.ts
// covers on its configuration side — push delivery itself still needs a real
// device (see docs/backlog.md's [human] checklist). This spec runs while the
// tab is foregrounded, so WorkoutLogger.vue's handleAddSet takes the in-app
// path rather than sending a push.
test('rest timer screen: shows after a set, skip dismisses it', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Rest Screen ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'Add rest timer' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('30')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Log')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()

  await expect(page.getByText('Nice work — take a breather')).toBeVisible()
  await expect(page.getByText(`Next: ${exerciseName}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Rest' })).toBeVisible()

  await page.getByRole('button', { name: 'Skip Rest' }).click()
  await expect(page.getByText('Nice work — take a breather')).toHaveCount(0)

  // The rest screen coming and going doesn't touch the set that was logged.
  await expect(page.locator('li.row-wrap', { hasText: exerciseName })).toContainText('10 × 45lb')
})

test('rest timer screen: auto-dismisses when the countdown finishes', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Rest Auto ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'Add rest timer' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('1')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Log')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('20')
  await page.getByRole('button', { name: 'Add set' }).click()

  await expect(page.getByRole('button', { name: 'Skip Rest' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Rest' })).toHaveCount(0, { timeout: 3000 })
})
