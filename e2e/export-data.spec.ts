import { readFile } from 'node:fs/promises'
import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

test('exports seeded training data as a dated, versioned download', async ({ page, stamp }) => {
  const userId = await signInAsTestUser(page)
  const admin = getAdminClient()
  const exerciseName = `E2E Export exercise ${stamp}`
  const templateName = `E2E Export template ${stamp}`
  const notes = `E2E Export workout ${stamp}`

  const exerciseResult = await admin.from('exercises').insert({
    user_id: userId, name: exerciseName, setup_notes: 'Seat 4', is_archived: true,
  }).select().single()
  expect(exerciseResult.error).toBeNull()
  const exercise = exerciseResult.data!
  const templateResult = await admin.from('workout_templates').insert({
    user_id: userId, name: templateName, is_archived: true,
  }).select().single()
  expect(templateResult.error).toBeNull()
  const template = templateResult.data!
  const targetResult = await admin.from('workout_template_exercises').insert({
    template_id: template.id, exercise_id: exercise.id, position: 0, target_sets: 3,
  }).select().single()
  expect(targetResult.error).toBeNull()
  const workoutResult = await admin.from('workouts').insert({
    user_id: userId, template_id: template.id, notes,
  }).select().single()
  expect(workoutResult.error).toBeNull()
  const workout = workoutResult.data!
  const setResult = await admin.from('sets').insert({
    workout_id: workout.id, exercise_id: exercise.id, set_index: 0,
    reps: 6, weight: 42.5, weight_unit: 'kg', rpe: 8.5,
  }).select().single()
  expect(setResult.error).toBeNull()

  await goTo(page, 'Exercises')
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export training data' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^repbunny-training-data-\d{4}-\d{2}-\d{2}\.json$/)
  const backup = JSON.parse(await readFile(await download.path(), 'utf8'))
  expect(backup.version).toBe(1)
  expect(backup.exported_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  expect(backup.exercises).toContainEqual(expect.objectContaining({ id: exercise.id, name: exerciseName, setup_notes: 'Seat 4', is_archived: true }))
  expect(backup.workout_templates).toContainEqual(expect.objectContaining({ id: template.id, name: templateName, is_archived: true }))
  expect(backup.workout_template_exercises).toContainEqual(expect.objectContaining({ id: targetResult.data!.id, position: 0, target_sets: 3 }))
  expect(backup.workouts).toContainEqual(expect.objectContaining({ id: workout.id, notes }))
  expect(backup.sets).toContainEqual(expect.objectContaining({ id: setResult.data!.id, reps: 6, weight: 42.5, weight_unit: 'kg', rpe: 8.5 }))
  expect(backup).not.toHaveProperty('push_subscriptions')
  expect(backup).not.toHaveProperty('access_token')
})

test('export reads every page and never downloads after a fetch error', async ({ page }) => {
  const userId = await signInAsTestUser(page)
  await goTo(page, 'Exercises')
  const ranges: number[] = []
  await page.route('**/rest/v1/exercises?*', async (route) => {
    const url = new URL(route.request().url())
    // The export query selects all columns; the Exercises screen's own
    // initial fetch has already completed before this route is installed.
    const offset = Number(url.searchParams.get('offset') ?? 0)
    const limit = Number(url.searchParams.get('limit') ?? 500)
    ranges.push(offset)
    const count = Math.max(0, Math.min(limit, 1001 - offset))
    const rows = Array.from({ length: count }, (_, index) => ({
      id: `mock-${offset + index}`, user_id: userId, name: `Exercise ${offset + index}`,
      is_archived: false, setup_notes: null, rest_seconds: null,
    }))
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rows) })
  })

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export training data' }).click()
  const backup = JSON.parse(await readFile(await (await downloadPromise).path(), 'utf8'))
  expect(ranges).toEqual([0, 500, 1000])
  expect(backup.exercises).toHaveLength(1001)
  expect(backup.exercises[1000].name).toBe('Exercise 1000')

  await page.unroute('**/rest/v1/exercises?*')
  await page.route('**/rest/v1/exercises?*', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Export test failure' }) }))
  let downloaded = false
  page.once('download', () => { downloaded = true })
  await page.getByRole('button', { name: 'Export training data' }).click()
  await expect(page.getByRole('alert')).toContainText('Could not export exercises', { timeout: 20000 })
  expect(downloaded).toBe(false)
})
