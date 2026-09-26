import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Item 73: ExerciseList, TemplateManager, WorkoutHistory, and
// ExerciseHistoryDetail all show branded skeleton-row placeholders
// (SkeletonRows.vue) instead of a bare "Loading…" string while their
// store's `loading` flag is true. Delays the underlying Supabase fetch so
// the loading window is long enough to assert against, then lets it
// through and confirms the skeleton is gone.
test('Exercises and History show skeleton rows while loading, then real content', async ({ page }) => {
  await signInAsTestUser(page)

  let releaseExercises: () => void
  const exercisesGate = new Promise<void>((resolve) => {
    releaseExercises = resolve
  })
  await page.route('**/rest/v1/exercises?*', async (route) => {
    if (route.request().method() === 'GET') await exercisesGate
    await route.continue()
  })

  await goTo(page, 'Exercises')
  await expect(page.locator('.skeleton-row')).toHaveCount(3)
  await expect(page.locator('p:text-is("Loading…")')).toHaveCount(0)
  releaseExercises!()
  await expect(page.locator('.skeleton-row')).toHaveCount(0)

  let releaseWorkouts: () => void
  const workoutsGate = new Promise<void>((resolve) => {
    releaseWorkouts = resolve
  })
  await page.route('**/rest/v1/workouts?*', async (route) => {
    if (route.request().method() === 'GET') await workoutsGate
    await route.continue()
  })

  await goTo(page, 'History')
  await expect(page.locator('.skeleton-row')).toHaveCount(3)
  await expect(page.locator('p:text-is("Loading…")')).toHaveCount(0)
  releaseWorkouts!()
  await expect(page.locator('.skeleton-row')).toHaveCount(0)
})

// Regression: a re-fetch (navigating away from Templates and back, which
// remounts TemplateManager and re-triggers fetchTemplates while the store
// still holds the previous fetch's rows) used to render the skeleton and the
// stale real rows at the same time, since only SkeletonRows was gated on
// `templates.loading` and the real `<ul>` list was always rendered.
test('Templates: skeleton and stale real rows never render at the same time on a re-fetch', async ({ page, stamp }) => {
  const name = `E2E Skeleton Template ${stamp}`
  const userId = await signInAsTestUser(page)
  const admin = getAdminClient()
  await admin.from('workout_templates').insert({ user_id: userId, name })

  await goTo(page, 'Templates')
  await expect(page.getByText(name)).toBeVisible()

  let release: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route('**/rest/v1/workout_templates?*', async (route) => {
    if (route.request().method() === 'GET') await gate
    await route.continue()
  })

  await goTo(page, 'Home')
  await goTo(page, 'Templates')

  await expect(page.locator('.skeleton-row')).toHaveCount(3)
  await expect(page.getByText(name)).toHaveCount(0)

  release!()
  await expect(page.locator('.skeleton-row')).toHaveCount(0)
  await expect(page.getByText(name)).toBeVisible()
})
