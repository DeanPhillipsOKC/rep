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

  // The three lookups below are independent of each other (none reads a
  // result the others produce), so item 82 runs them concurrently instead of
  // one at a time -- the FK-ordered *deletes* further down still can't start
  // until the ids they depend on are known, so those stay sequential.
  const [{ data: exerciseRows }, { data: templateRows }, { data: notedWorkoutRows }] = await Promise.all([
    admin.from('exercises').select('id').ilike('name', pattern),
    admin.from('workout_templates').select('id').ilike('name', pattern),
    // Some specs (e.g. zero-set-cleanup, workout-header's freeform case)
    // stamp a freeform workout's notes instead of/alongside a template or
    // exercise.
    admin.from('workouts').select('id').ilike('notes', pattern),
  ])
  const exerciseIds = (exerciseRows ?? []).map((r) => r.id)
  const templateIds = (templateRows ?? []).map((r) => r.id)

  const workoutIds = new Set()
  for (const row of notedWorkoutRows ?? []) workoutIds.add(row.id)

  const [setRows, templateWorkoutRows] = await Promise.all([
    exerciseIds.length
      ? admin.from('sets').select('workout_id').in('exercise_id', exerciseIds).then((r) => r.data)
      : null,
    templateIds.length
      ? admin.from('workouts').select('id').in('template_id', templateIds).then((r) => r.data)
      : null,
  ])
  for (const row of setRows ?? []) workoutIds.add(row.workout_id)
  for (const row of templateWorkoutRows ?? []) workoutIds.add(row.id)

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
