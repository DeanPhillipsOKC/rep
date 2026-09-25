import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'
import { dismissCelebrationIfShown } from './fixtures/celebration'

async function startWithExercise(page: import('@playwright/test').Page, name: string) {
  await signInAsTestUser(page)
  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(name)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: name })
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('30')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()
  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: name })
  const row = page.locator('.set-row-draft').first()
  await row.getByLabel('Reps').fill('8')
  await row.getByLabel('Weight').fill('100')
  return row
}

async function persistedSets(exerciseName: string) {
  const admin = getAdminClient()
  const { data: exercise } = await admin.from('exercises').select('id').eq('name', exerciseName).single()
  expect(exercise).not.toBeNull()
  const { data, error } = await admin.from('sets').select('id, reps, weight, weight_unit, rpe')
    .eq('exercise_id', exercise!.id)
  expect(error).toBeNull()
  return data ?? []
}

test('set save rejection keeps fields and rest idle, then retries current values once', async ({ page, stamp }) => {
  const name = `E2E Rejected Set ${stamp}`
  const row = await startWithExercise(page, name)
  await row.getByRole('button', { name: '+RPE' }).click()
  await row.getByLabel('RPE (optional)').fill('8.5')
  let rejected = false
  await page.route('**/rest/v1/sets?*', async (route) => {
    if (route.request().method() === 'POST' && !rejected) {
      rejected = true
      await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({
        code: '23514', message: 'simulated rejection', details: null, hint: null,
      }) })
    } else await route.continue()
  })

  await row.getByRole('button', { name: 'Add set' }).click()
  await expect(row.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(row).toContainText('Set not confirmed')
  await expect(row.getByLabel('Reps')).toHaveValue('8')
  await expect(row.getByLabel('Weight')).toHaveValue('100')
  await expect(row.getByLabel('RPE (optional)')).toHaveValue('8.5')
  await expect(page.getByRole('button', { name: 'lb', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByLabel('Exercise').locator('option:checked')).toHaveText(name)
  await expect(page.locator('.set-row-logged')).toHaveCount(0)
  await expect(page.locator('.rest-headline')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeDisabled()
  expect(await persistedSets(name)).toHaveLength(0)

  await row.getByLabel('Weight').fill('105')
  await row.getByRole('button', { name: 'Retry' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.set-row-done')).toContainText('8 × 105lb')
  await expect(page.locator('.rest-headline')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeEnabled()
  const saved = await persistedSets(name)
  expect(saved).toHaveLength(1)
  expect(saved[0].weight).toBe(105)
  expect(saved[0].rpe).toBe(8.5)
})

test('lost response reconciles the original set without inserting changed retry values', async ({ page, stamp }) => {
  const name = `E2E Uncertain Set ${stamp}`
  const row = await startWithExercise(page, name)
  let lostResponse = false
  let posts = 0
  await page.route('**/rest/v1/sets?*', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    posts += 1
    if (!lostResponse) {
      lostResponse = true
      const response = await route.fetch()
      expect(response.ok()).toBeTruthy()
      await route.abort('failed')
    } else await route.continue()
  })

  await row.getByRole('button', { name: 'Add set' }).click()
  await expect(row.getByRole('button', { name: 'Retry' })).toBeVisible()
  await expect(page.locator('.set-row-logged')).toHaveCount(0)
  await expect(page.locator('.rest-headline')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeDisabled()
  expect(await persistedSets(name)).toHaveLength(1)

  await row.getByLabel('Weight').fill('110')
  await row.getByRole('button', { name: 'Retry' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('.set-row-done')).toContainText('8 × 100lb')
  await expect(page.locator('.set-row-draft')).toHaveCount(1)
  await expect(page.locator('.rest-headline')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Finish workout' })).toBeEnabled()
  expect(posts).toBe(1)
  const saved = await persistedSets(name)
  expect(saved).toHaveLength(1)
  expect(saved[0].weight).toBe(100)
})
