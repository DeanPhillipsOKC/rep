import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Covers docs/backlog.md item 25: archiving an exercise only flips
// exercises.is_archived, it never touches workout_template_exercises, so an
// archived exercise attached to a template kept surfacing as a suggested
// chip and a loggable dropdown option every time that template was used.
test('archived exercise stops appearing in a template it is still attached to', async ({ page, stamp }) => {
  const exerciseName = `E2E Archived ${stamp}`
  const templateName = `E2E Push Day ${stamp}`

  const admin = getAdminClient()

  // This test deletes (archives) its own only exercise partway through —
  // without a second, still-active exercise on the account, that leaves
  // exercises.activeExercises at zero, which flips WorkoutLogger.vue over to
  // its zero-exercise welcome card (docs/backlog-archive.md item 27) and
  // pulls the Home screen's template chips out from under the later steps
  // below. Seed a throwaway second exercise directly via the admin client
  // (item 57's pattern) so archiving `exerciseName` never zeroes the count.
  // Seeded via signInAsTestUser's beforeNavigate hook rather than
  // seed-then-reload, which can leave two competing onMounted fetches racing
  // each other (docs/backlog.md item 58).
  await signInAsTestUser(page, {
    beforeNavigate: async (userId) => {
      await admin.from('exercises').insert({ user_id: userId, name: `E2E Baseline ${stamp}` })
    },
  })

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row', { hasText: exerciseName })).toBeVisible()

  await goTo(page, 'Exercises')
  // The confirm step swaps the exercise's name out of the row entirely (same
  // shape as e2e/template-archive-confirm.spec.ts), so the "Confirm delete"
  // click can't stay scoped to a `hasText: exerciseName` locator — query it
  // directly instead, safe since only one row is ever mid-confirm at a time.
  await page.locator('.row-wrap', { hasText: exerciseName }).getByRole('button', { name: 'Delete exercise' }).click()
  await page.getByRole('button', { name: 'Confirm delete' }).click()
  await expect(page.getByText(exerciseName)).toHaveCount(0)

  // Back on Templates, in the same session: templates.exercisesByTemplate
  // was already cached from expanding this template earlier, and only ever
  // fetches once per template per session — so this checks the "Archived"
  // tag against exactly that stale cache, not a freshly re-fetched join.
  await goTo(page, 'Templates')
  await page.getByText(templateName).click()
  const templateExerciseRow = page.locator('.exercise-row', { hasText: exerciseName })
  await expect(templateExerciseRow.getByText('Archived')).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()

  // Wait for the suggested-chips section to actually mount before checking
  // what it offers — asserting toHaveCount(0) against a section that hasn't
  // rendered yet (activeWorkoutId/activeTemplateId still settling after the
  // start-workout request) trivially "passes" without ever having checked
  // the real, post-render list. Waiting on the container itself rather than
  // e.g. the "Add set" button, since with only one (now-excluded) exercise
  // on this template the picker legitimately has nothing to auto-select.
  await page.locator('.suggested').waitFor({ state: 'attached' })

  await expect(page.locator('.suggested .chip', { hasText: exerciseName })).toHaveCount(0)
  await expect(page.getByLabel('Exercise').getByRole('option', { name: exerciseName })).toHaveCount(0)

  // Started but never logged a set — Finish here would just discard it (see
  // e2e/zero-set-cleanup.spec.ts), which also keeps this spec from leaving a
  // permanent zero-set `workouts` row behind on every run (backlog item 56).
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
})
