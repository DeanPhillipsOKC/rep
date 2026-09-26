import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Covers docs/backlog.md's RPE quick-entry item: the +RPE toggle used to
// only reveal the input without focusing it, so a first tap just swapped
// the `+RPE` label for an unfocused `RPE` placeholder and typing a value
// required a second tap. Also covers the select-on-focus behavior added
// alongside it, so a carried-over RPE value (pre-fill.spec.ts) is a
// one-keystroke overwrite instead of requiring manual cursor repositioning.
test('RPE quick-entry: toggle focuses the input in one tap', async ({ page, stamp }) => {
  const exerciseName = `E2E RPE Toggle ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  await page.getByRole('button', { name: '+RPE' }).click()
  const rpeInput = page.getByLabel('RPE (optional)')
  await expect(rpeInput).toBeFocused()

  // Typing immediately, with no second tap/click, must land in the field.
  await page.keyboard.type('7')
  await expect(rpeInput).toHaveValue('7')
})

test('RPE quick-entry: carried-over value is selected on focus for one-keystroke overwrite', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E RPE Carryover ${stamp}`
  const templateName = `E2E RPE Carryover Day ${stamp}`

  const userId = await signInAsTestUser(page)

  // The "previous set with an RPE" this carries over is pre-existing state,
  // not behavior under test — seed it directly via the admin client instead
  // of driving a full prior workout through the UI (backlog item 57).
  const admin = getAdminClient()
  const { data: exercise } = await admin
    .from('exercises')
    .insert({ user_id: userId, name: exerciseName })
    .select('id')
    .single()
  const { data: template } = await admin
    .from('workout_templates')
    .insert({ user_id: userId, name: templateName })
    .select('id')
    .single()
  await admin
    .from('workout_template_exercises')
    .insert([{ template_id: template!.id, exercise_id: exercise!.id, position: 0 }])
  const { data: workout } = await admin
    .from('workouts')
    .insert({ user_id: userId, template_id: template!.id })
    .select('id')
    .single()
  await admin.from('sets').insert({
    workout_id: workout!.id,
    exercise_id: exercise!.id,
    set_index: 0,
    reps: 5,
    weight: 200,
    weight_unit: 'lb',
    rpe: 8,
  })

  // Reload so the app's onMounted fetch picks up the seeded template — the
  // initial navigation in signInAsTestUser happened before it existed.
  await page.reload()

  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()

  const rpeInput = page.getByLabel('RPE (optional)')
  await expect(rpeInput).toHaveValue('8')

  // Tapping into the pre-filled field selects its value, so typing a
  // replacement overwrites it outright instead of inserting at the cursor.
  await rpeInput.click()
  await page.keyboard.type('3')
  await expect(rpeInput).toHaveValue('3')
})
