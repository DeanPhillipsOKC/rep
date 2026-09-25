import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Covers docs/backlog.md item 3: starting a new workout against a template
// that already has a logged instance shows a "Last time" card and pre-fills
// the reps/weight fields from the most recent matching set. Also covers the
// "Last time" card narrowing to the selected exercise once one is picked,
// so a multi-exercise template doesn't force scrolling mid-workout.
test('pre-fill: last workout of the same template surfaces on the next one', async ({ page, stamp }) => {
  const exerciseName = `E2E Squat ${stamp}`
  const otherExerciseName = `E2E Deadlift ${stamp}`
  const templateName = `E2E Leg Day ${stamp}`

  const userId = await signInAsTestUser(page)

  // The "last workout of the same template" this test pre-fills against is
  // pre-existing state, not behavior under test — seed the exercises,
  // template, and a completed prior workout directly via the admin client
  // instead of driving the whole logging UI just to create fixture data
  // (backlog item 57).
  const admin = getAdminClient()
  const { data: squat } = await admin
    .from('exercises')
    .insert({ user_id: userId, name: exerciseName })
    .select('id')
    .single()
  const { data: deadlift } = await admin
    .from('exercises')
    .insert({ user_id: userId, name: otherExerciseName })
    .select('id')
    .single()
  const { data: template } = await admin
    .from('workout_templates')
    .insert({ user_id: userId, name: templateName })
    .select('id')
    .single()
  await admin.from('workout_template_exercises').insert([
    { template_id: template!.id, exercise_id: squat!.id, position: 0 },
    { template_id: template!.id, exercise_id: deadlift!.id, position: 1 },
  ])
  const { data: workout } = await admin
    .from('workouts')
    .insert({ user_id: userId, template_id: template!.id })
    .select('id')
    .single()
  await admin
    .from('sets')
    .insert({ workout_id: workout!.id, exercise_id: squat!.id, set_index: 0, reps: 8, weight: 185, weight_unit: 'lb' })
  await admin
    .from('sets')
    .insert({ workout_id: workout!.id, exercise_id: deadlift!.id, set_index: 0, reps: 5, weight: 225, weight_unit: 'lb' })

  // Reload so the app's onMounted fetch picks up the seeded template —
  // the initial navigation in signInAsTestUser happened before it existed.
  await page.reload()

  // Second workout against the same template, but abandoned with no sets
  // logged (e.g. started by mistake). This must not shadow the real data
  // from the seeded workout on the next lookup.
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  // Backlog item 51: finishing with no sets logged now confirms before discarding.
  await page.getByRole('button', { name: 'Discard workout' }).click()

  // Third workout against the same template: should show the last workout
  // that actually had sets (the seeded one), skipping the empty one.
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()

  const lastTime = page.locator('.last-time')
  await expect(lastTime).toContainText(exerciseName)
  await expect(lastTime).toContainText(otherExerciseName)
  await expect(lastTime).toContainText('8×185lb')
  await expect(lastTime).toContainText('5×225lb')

  // Picking an exercise narrows the card to just that exercise.
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(lastTime).toContainText(exerciseName)
  await expect(lastTime).not.toContainText(otherExerciseName)
  await expect(page.getByLabel('Reps')).toHaveValue('8')
  await expect(page.getByLabel('Weight')).toHaveValue('185')

  // Switching exercises re-narrows rather than staying stuck on the first pick.
  await page.getByRole('button', { name: otherExerciseName, exact: true }).click()
  await expect(lastTime).toContainText(otherExerciseName)
  await expect(lastTime).not.toContainText(exerciseName)
  await expect(page.getByLabel('Reps')).toHaveValue('5')
  await expect(page.getByLabel('Weight')).toHaveValue('225')
})

// Covers docs/backlog.md item 9: pre-fill must index into the previous
// workout's sets by set position, not always grab the last set logged —
// otherwise a superset-style session (alternating exercises) pre-fills set 1
// of today from set 2 of last time, which is backwards.
test('pre-fill: set position tracks across exercises logged in parallel', async ({ page, stamp }) => {
  const exerciseName = `E2E Bench ${stamp}`
  const otherExerciseName = `E2E Row ${stamp}`
  const templateName = `E2E Push Pull ${stamp}`

  const userId = await signInAsTestUser(page)

  // The first (superset) workout is pre-existing state this test pre-fills
  // against, not behavior under test — seed it directly via the admin
  // client rather than driving the logging UI four times over just to set
  // up fixture data (backlog item 57). Sets are inserted one at a time, in
  // the same A/B/A/B order the original UI flow logged them in, so the
  // set_index trigger (supabase/schema.sql) assigns the same relative
  // per-exercise ordering pre-fill depends on. The first exercise's second
  // set is deliberately lighter (fatigue) so a "last set logged" pre-fill
  // would be obviously wrong for set 1 next time.
  const admin = getAdminClient()
  const { data: bench } = await admin
    .from('exercises')
    .insert({ user_id: userId, name: exerciseName })
    .select('id')
    .single()
  const { data: row } = await admin
    .from('exercises')
    .insert({ user_id: userId, name: otherExerciseName })
    .select('id')
    .single()
  const { data: template } = await admin
    .from('workout_templates')
    .insert({ user_id: userId, name: templateName })
    .select('id')
    .single()
  await admin.from('workout_template_exercises').insert([
    { template_id: template!.id, exercise_id: bench!.id, position: 0 },
    { template_id: template!.id, exercise_id: row!.id, position: 1 },
  ])
  const { data: workout } = await admin
    .from('workouts')
    .insert({ user_id: userId, template_id: template!.id })
    .select('id')
    .single()
  const rounds: Array<[string, number, number]> = [
    [bench!.id, 10, 135],
    [row!.id, 5, 225],
    [bench!.id, 8, 115],
    [row!.id, 5, 225],
  ]
  for (const [exerciseId, reps, weight] of rounds) {
    await admin.from('sets').insert({ workout_id: workout!.id, exercise_id: exerciseId, reps, weight, weight_unit: 'lb' })
  }

  // Reload so the app's onMounted fetch picks up the seeded template —
  // the initial navigation in signInAsTestUser happened before it existed.
  await page.reload()

  // Second workout: set 1 for the first exercise should pre-fill from its
  // set 1 last time (10x135), not its set 2 (8x115).
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(page.getByLabel('Reps')).toHaveValue('10')
  await expect(page.getByLabel('Weight')).toHaveValue('135')
  await page.getByRole('button', { name: 'Add set' }).click()

  // Without re-picking the exercise (same chip, same exerciseId — a plain
  // watch(exerciseId) would never re-fire here), the pre-fill must still
  // advance to set 2 (8x115) as soon as the set above is logged.
  await expect(page.getByLabel('Reps')).toHaveValue('8')
  await expect(page.getByLabel('Weight')).toHaveValue('115')

  await page.getByRole('button', { name: otherExerciseName, exact: true }).click()
  await expect(page.getByLabel('Reps')).toHaveValue('5')
  await expect(page.getByLabel('Weight')).toHaveValue('225')
  await page.getByRole('button', { name: 'Add set' }).click()

  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(page.getByLabel('Reps')).toHaveValue('8')
  await expect(page.getByLabel('Weight')).toHaveValue('115')
  await page.getByRole('button', { name: 'Add set' }).click()

  // A third round for the first exercise has no matching set last time —
  // falls back to no pre-fill instead of repeating stale numbers.
  await page.getByRole('button', { name: otherExerciseName, exact: true }).click()
  await page.getByRole('button', { name: 'Add set' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await expect(page.getByLabel('Reps')).toHaveValue('')
  await expect(page.getByLabel('Weight')).toHaveValue('')
})
