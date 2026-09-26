// Shared deletion logic for one E2E test stamp's rows, used by both the
// Playwright cleanup fixture (e2e/fixtures/cleanup.ts, graceful per-test
// teardown) and the standalone sweep script (scripts/sweep-stale-e2e-rows.mjs,
// which catches stamps that never got a graceful teardown — see docs/backlog.md
// item 58 / docs/backlog-archive.md). Split out so the sweep script (a plain
// Node script, no Playwright) can reuse the exact same cascade-safe deletion
// order instead of re-deriving it.
//
// Deletion order matters: workouts first (cascades sets), then templates
// (cascades workout_template_exercises), then exercises last, since
// FK constraints only cascade in that direction.
import { getAdminClient } from './mint-test-session.mjs'

export async function cleanupStamp(stamp) {
  const admin = getAdminClient()
  const pattern = `%${stamp}%`

  const { data: exerciseRows } = await admin.from('exercises').select('id').ilike('name', pattern)
  const exerciseIds = (exerciseRows ?? []).map((r) => r.id)

  const { data: templateRows } = await admin
    .from('workout_templates')
    .select('id')
    .ilike('name', pattern)
  const templateIds = (templateRows ?? []).map((r) => r.id)

  const workoutIds = new Set()

  if (exerciseIds.length) {
    const { data: setRows } = await admin.from('sets').select('workout_id').in('exercise_id', exerciseIds)
    for (const row of setRows ?? []) workoutIds.add(row.workout_id)
  }
  if (templateIds.length) {
    const { data: workoutRows } = await admin.from('workouts').select('id').in('template_id', templateIds)
    for (const row of workoutRows ?? []) workoutIds.add(row.id)
  }
  // Some specs (e.g. zero-set-cleanup, workout-header's freeform case) stamp
  // a freeform workout's notes instead of/alongside a template or exercise.
  const { data: notedWorkoutRows } = await admin.from('workouts').select('id').ilike('notes', pattern)
  for (const row of notedWorkoutRows ?? []) workoutIds.add(row.id)

  if (workoutIds.size) {
    await admin.from('workouts').delete().in('id', [...workoutIds])
  }
  if (templateIds.length) {
    await admin.from('workout_templates').delete().in('id', templateIds)
  }
  if (exerciseIds.length) {
    await admin.from('exercises').delete().in('id', exerciseIds)
  }

  return { exercises: exerciseIds.length, workout_templates: templateIds.length, workouts: workoutIds.size }
}
