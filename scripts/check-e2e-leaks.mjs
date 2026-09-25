// Sanity check for backlog item 57: confirms the e2e suite's afterEach
// cleanup (e2e/fixtures/cleanup.ts) isn't leaving stamped rows behind. Run
// after a full `npm run test:e2e` pass; a nonzero count here means some
// spec created data outside the `E2E ... <stamp>` naming convention the
// cleanup fixture keys off, or the fixture itself regressed.
import { getAdminClient } from './lib/mint-test-session.mjs'

const admin = getAdminClient()
const { data: exercises } = await admin.from('exercises').select('id').ilike('name', '%E2E%')
const { data: templates } = await admin.from('workout_templates').select('id').ilike('name', '%E2E%')
const { data: workouts } = await admin.from('workouts').select('id').ilike('notes', '%E2E%')

const counts = {
  exercises: exercises?.length ?? 0,
  workout_templates: templates?.length ?? 0,
  workouts: workouts?.length ?? 0,
}
console.log(counts)

if (Object.values(counts).some((n) => n > 0)) {
  console.error('Leftover E2E-stamped rows found — see docs/backlog.md item 57.')
  process.exit(1)
}
