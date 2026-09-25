import { test as base, expect } from '@playwright/test'
import { getAdminClient } from '../../scripts/lib/mint-test-session.mjs'

// Backlog item 57: every spec stamps the entities it creates with a unique
// `E2E <thing> <stamp>` name so runs don't collide, but nothing ever deleted
// them afterward — the shared test account accumulated 1000+ rows over
// months, which silently truncates unbounded `.select()` queries at
// PostgREST's default page size (root cause of item 56's "random" failures).
// This fixture generates that stamp and, once the test (pass or fail) is
// done with it, deletes everything the stamp touched via the admin client
// (RLS is bypassed on purpose here — same trust level as session minting).
//
// Deletion order matters: workouts first (cascades sets), then templates
// (cascades workout_template_exercises), then exercises last, since
// FK constraints only cascade in that direction.
export const test = base.extend<{ stamp: number }>({
  stamp: async ({}, use) => {
    const stamp = Date.now() + Math.floor(Math.random() * 1000)
    await use(stamp)
    await cleanupStamp(stamp)
  },
})

export { expect }

async function cleanupStamp(stamp: number) {
  const admin = getAdminClient()
  const pattern = `%${stamp}%`

  const { data: exerciseRows } = await admin.from('exercises').select('id').ilike('name', pattern)
  const exerciseIds = (exerciseRows ?? []).map((r) => r.id)

  const { data: templateRows } = await admin
    .from('workout_templates')
    .select('id')
    .ilike('name', pattern)
  const templateIds = (templateRows ?? []).map((r) => r.id)

  const workoutIds = new Set<string>()

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
}
