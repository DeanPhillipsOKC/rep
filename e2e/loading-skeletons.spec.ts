import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

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
