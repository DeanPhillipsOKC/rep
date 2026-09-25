import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

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
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('30')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  // First-ever set for this brand-new exercise is also an all-time best —
  // dismiss the record celebration (it renders on top of the rest screen)
  // before interacting with what's underneath.
  await dismissCelebrationIfShown(page)

  // Backlog item 29: the headline now rotates between a few phrases, so
  // assert on the element rather than a specific string.
  await expect(page.locator('.rest-headline')).toBeVisible()
  await expect(page.getByText(`Next: ${exerciseName}`)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Rest' })).toBeVisible()

  await page.getByRole('button', { name: 'Skip Rest' }).click()
  await expect(page.locator('.rest-headline')).toHaveCount(0)

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
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('1')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('20')
  await page.getByRole('button', { name: 'Add set' }).click()

  await expect(page.getByRole('button', { name: 'Skip Rest' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Rest' })).toHaveCount(0, { timeout: 3000 })
})

// Covers docs/backlog.md item 52's ±15s manual adjustment.
test('rest timer screen: -15s and +15s adjust the countdown', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Rest Adjust ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('60')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  const countdown = page.locator('.rest-countdown')
  await expect(countdown).toBeVisible()

  async function readCountdownSeconds() {
    const text = (await countdown.textContent())?.trim() ?? ''
    const [m, s] = text.split(':').map(Number)
    return m * 60 + s
  }

  const before = await readCountdownSeconds()
  await page.getByRole('button', { name: '-15s' }).click()
  await expect.poll(readCountdownSeconds).toBeLessThan(before)
  const afterShrink = await readCountdownSeconds()
  expect(before - afterShrink).toBeGreaterThanOrEqual(13)
  expect(before - afterShrink).toBeLessThanOrEqual(16)

  await page.getByRole('button', { name: '+15s' }).click()
  await expect.poll(readCountdownSeconds).toBeGreaterThan(afterShrink)
  const afterGrow = await readCountdownSeconds()
  expect(afterGrow - afterShrink).toBeGreaterThanOrEqual(13)
  expect(afterGrow - afterShrink).toBeLessThanOrEqual(16)
})

// Covers docs/backlog.md item 52's non-destructive return: "Back to workout"
// keeps the rest period running behind the scenes instead of canceling it
// the way "Skip Rest" does.
test('rest timer screen: back to workout minimizes without canceling, resume restores it', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Rest Minimize ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('30')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  await page.getByRole('button', { name: 'Back to workout' }).click()
  await expect(page.locator('.rest-headline')).toHaveCount(0)
  await expect(page.getByText(/Resting \d:\d\d/)).toBeVisible()

  // Minimized, but the workout underneath is still fully usable.
  await expect(page.locator('li.row-wrap', { hasText: exerciseName })).toContainText('10 × 45lb')

  await page.getByRole('button', { name: 'Resume' }).click()
  await expect(page.locator('.rest-headline')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Skip Rest' })).toBeVisible()

  // The mini-bar's own Skip also ends the rest entirely, same as Skip Rest.
  await page.getByRole('button', { name: 'Back to workout' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  await expect(page.getByText(/Resting \d:\d\d/)).toHaveCount(0)
})
