import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 15's schema/UI half: configuring a per-exercise
// rest timer duration, add/edit/persist, same inline-editor pattern as
// e2e/exercise-notes.spec.ts. Actual push delivery (VAPID subscribe, Edge
// Function dispatch, real notification on a locked device) needs a real
// browser permission grant and a deployed Edge Function — that's the
// [human] device-verification pass noted in docs/backlog.md, not something
// this spec can exercise headlessly.
test('exercise rest timer: add, edit, and clear a duration', async ({ page }) => {
  const stamp = Date.now()
  const exerciseName = `E2E Leg Curl ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  const row = page.locator('.row-wrap', { hasText: exerciseName })
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await row.getByLabel('Rest timer (seconds)').fill('90')
  await row.getByRole('button', { name: 'Save' }).click()

  await expect(row.locator('.tag-pill', { hasText: 'Rest: 90s' })).toBeVisible()

  // Edit persists correctly, not just create.
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await row.getByLabel('Rest timer (seconds)').fill('30')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.locator('.tag-pill', { hasText: 'Rest: 30s' })).toBeVisible()

  // Clearing the field removes the timer (no alert configured).
  await row.getByRole('button', { name: 'Edit exercise' }).click()
  await row.getByLabel('Rest timer (seconds)').fill('')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.locator('.tag-pill', { hasText: 'Rest:' })).toHaveCount(0)
})
