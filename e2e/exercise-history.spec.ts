import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Covers docs/backlog.md item 1: a focused per-exercise history detail,
// opened from the active logger, showing past workouts newest-first with
// sets in set order, mixed lb/kg weights kept separate (never converted),
// and a per-unit "heaviest completed set" summary. Also confirms opening it
// mid-workout doesn't lose an unsaved draft row -- it's an overlay, not a
// route, specifically so WorkoutLogger.vue never unmounts underneath it.
test('exercise history: opened from the logger shows newest-first sets across mixed units without losing a draft row', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E History Bench ${stamp}`

  const admin = getAdminClient()
  const now = Date.now()

  await signInAsTestUser(page, {
    beforeNavigate: async (userId) => {
      const { data: exercise } = await admin
        .from('exercises')
        .insert({ user_id: userId, name: exerciseName })
        .select('id')
        .single()

      // Older workout, logged in lb.
      const { data: olderWorkout } = await admin
        .from('workouts')
        .insert({ user_id: userId, performed_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString() })
        .select('id')
        .single()
      await admin
        .from('sets')
        .insert({ workout_id: olderWorkout!.id, exercise_id: exercise!.id, set_index: 0, reps: 8, weight: 185, weight_unit: 'lb' })
      await admin
        .from('sets')
        .insert({ workout_id: olderWorkout!.id, exercise_id: exercise!.id, set_index: 1, reps: 8, weight: 190, weight_unit: 'lb' })

      // Newer workout, logged in kg with an RPE on the first set.
      const { data: newerWorkout } = await admin
        .from('workouts')
        .insert({ user_id: userId, performed_at: new Date(now).toISOString() })
        .select('id')
        .single()
      await admin
        .from('sets')
        .insert({ workout_id: newerWorkout!.id, exercise_id: exercise!.id, set_index: 0, reps: 5, weight: 80, weight_unit: 'kg', rpe: 8 })
      await admin
        .from('sets')
        .insert({ workout_id: newerWorkout!.id, exercise_id: exercise!.id, set_index: 1, reps: 5, weight: 82.5, weight_unit: 'kg' })
    },
  })

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  // An unsaved draft row -- still there once the overlay below is dismissed
  // proves WorkoutLogger.vue was never unmounted to show it.
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('225')

  await page.getByRole('button', { name: 'View exercise history' }).click()

  const overlay = page.getByRole('dialog', { name: `${exerciseName} history` })
  await expect(overlay.getByRole('heading', { name: exerciseName })).toBeVisible()
  await expect(overlay.getByText('Archived')).toHaveCount(0)

  // Heaviest completed set stays separate per unit rather than converted.
  const summary = overlay.locator('.summary-values')
  await expect(summary).toContainText('190lb')
  await expect(summary).toContainText('82.5kg')

  const entries = overlay.locator('.history-entry')
  await expect(entries).toHaveCount(2)

  // Newest workout first.
  await expect(entries.nth(0).locator('.set-row')).toHaveCount(2)
  await expect(entries.nth(0).locator('.set-row').nth(0)).toContainText('5 × 80kg')
  await expect(entries.nth(0).locator('.set-row').nth(0)).toContainText('RPE 8')
  await expect(entries.nth(0).locator('.set-row').nth(1)).toContainText('5 × 82.5kg')

  // Older workout second, its own sets still in logged order.
  await expect(entries.nth(1).locator('.set-row')).toHaveCount(2)
  await expect(entries.nth(1).locator('.set-row').nth(0)).toContainText('8 × 185lb')
  await expect(entries.nth(1).locator('.set-row').nth(1)).toContainText('8 × 190lb')

  await overlay.getByRole('button', { name: 'Close history' }).click()
  await expect(overlay).not.toBeVisible()

  await expect(page.getByLabel('Reps')).toHaveValue('5')
  await expect(page.getByLabel('Weight')).toHaveValue('225')
})

// Covers the "no history yet" case from docs/backlog.md item 1, opened from
// the Exercises tab entry point rather than the logger.
test('exercise history: opened from the Exercises tab shows no history for a brand-new exercise', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E History Fresh ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  const row = page.locator('.row-wrap', { hasText: exerciseName })
  await row.getByRole('button', { name: 'View exercise history' }).click()

  const overlay = page.getByRole('dialog', { name: `${exerciseName} history` })
  await expect(overlay.getByRole('heading', { name: exerciseName })).toBeVisible()
  await expect(overlay.getByText('No sets logged for this exercise yet.')).toBeVisible()
  await expect(overlay.locator('.summary-values')).toHaveCount(0)
})
