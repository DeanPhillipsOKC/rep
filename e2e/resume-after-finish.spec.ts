import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'
import { selectExercise } from './fixtures/exercise'

// Covers docs/backlog.md's "Let an accidentally-finished workout be resumed"
// item: tapping "Finish workout" used to be a one-way door the moment any
// set existed (docs/backlog-archive.md item 51 only guards the zero-sets
// case). These specs drive the real "Finish workout" button (not a reload,
// unlike resume-workout.spec.ts's crash-recovery specs) and check the
// post-finish resume offer. For a templated workout that offer now lives on
// the volume-chart card itself as "Finished too early? Resume" (item 68) —
// "Log another workout" there goes straight to a new workout with no second
// gate. A freeform finish has no chart, so it still shows its own standalone
// "Resume your workout?" card immediately.

test('resume after finish: freeform workout with a set offers resume, and Resume restores it', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E ResumeFinish Freeform ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await selectExercise(page, exerciseName)
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('95')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('li.row-wrap', { hasText: '10 × 95lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()

  // No template on a freeform workout, so there's no volume chart in the
  // way — the resume offer must appear immediately, not just inside it.
  const prompt = page.locator('.card', { hasText: 'Resume your workout?' })
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText('Freeform workout')
  await expect(prompt).toContainText('1 set logged')
  await expect(page.getByRole('button', { name: 'Start workout' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Resume workout' }).click()

  // Genuinely active again, not a cosmetic replay: the prior set is back,
  // the header reflects the resumed workout, and logging can continue.
  await expect(page.getByRole('heading', { name: 'Freeform workout' })).toBeVisible()
  await expect(page.locator('li.row-wrap', { hasText: '10 × 95lb' })).toBeVisible()

  await selectExercise(page, exerciseName)
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('105')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('li.row-wrap', { hasText: '8 × 105lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
})

test('resume after finish: templated workout offers resume inside the volume chart, and Log another workout skips a second gate', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E ResumeFinish Squat ${stamp}`
  const templateName = `E2E ResumeFinish Day ${stamp}`

  await signInAsTestUser(page)

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

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('225')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('li.row-wrap', { hasText: '5 × 225lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Item 68: a templated workout with sets shows the post-finish card, and
  // the just-finished resume offer lives inside that same card as a
  // secondary affordance, not as a second card gating "Log another workout".
  // This is the template's first-ever completion (item 70's single-point
  // case), so the card holds the first-workout celebration, not the chart.
  const chart = page.getByTestId('post-finish-card')
  await expect(chart).toBeVisible()
  const resumeLink = chart.getByRole('button', { name: 'Finished too early? Resume' })
  await expect(resumeLink).toBeVisible()
  await expect(page.locator('.card', { hasText: 'Resume your workout?' })).toHaveCount(0)

  // "Log another workout" goes straight to the start screen — no second gate.
  await page.getByRole('button', { name: 'Log another workout' }).click()
  await expect(page.locator('.card', { hasText: 'Resume your workout?' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeDisabled()

  await goTo(page, 'History')
  const card = page.locator('.card', { hasText: templateName })
  await expect(card).toBeVisible()
  await expect(card.locator('li.row-wrap')).toContainText('5 × 225lb')
})

test('resume after finish: "Finished too early? Resume" on the volume chart restores the workout', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E ResumeFinish TooEarly ${stamp}`
  const templateName = `E2E ResumeFinish TooEarly Day ${stamp}`

  await signInAsTestUser(page)

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

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('185')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('li.row-wrap', { hasText: '5 × 185lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  // This template's first-ever completion (item 70's single-point case), so
  // the post-finish card holds the first-workout celebration, not the chart.
  await expect(page.getByTestId('post-finish-card')).toBeVisible()

  await page.getByRole('button', { name: 'Finished too early? Resume' }).click()

  // Genuinely resumed, not left stuck on the card: the workout is active
  // again under its template name with the prior set still there.
  await expect(page.getByRole('heading', { name: templateName, exact: true })).toBeVisible()
  await expect(page.locator('li.row-wrap', { hasText: '5 × 185lb' })).toBeVisible()
  await expect(page.getByTestId('post-finish-card')).toHaveCount(0)

  await page.getByRole('button', { name: 'Finish workout' }).click()
})

test('resume after finish: finishing with no sets logged does not offer to resume', async ({ page, stamp }) => {
  const templateName = `E2E ResumeFinish Empty ${stamp}`

  const admin = getAdminClient()

  // The start-workout form (including the template chips this test needs)
  // only renders once the account has at least one active exercise
  // (docs/backlog-archive.md item 27's zero-exercise welcome card) — this
  // test only exercises the template/resume path, so seed a throwaway
  // exercise directly via the admin client (item 57's pattern) rather than
  // creating one through the UI just to get past the welcome screen. Seeded
  // via signInAsTestUser's beforeNavigate hook rather than seed-then-reload,
  // which can leave two competing onMounted fetches racing each other
  // (docs/backlog.md item 58).
  await signInAsTestUser(page, {
    beforeNavigate: async (userId) => {
      await admin.from('exercises').insert({ user_id: userId, name: `E2E Baseline ${stamp}` })
    },
  })

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await expect(page.getByText('Finish with no sets logged? This will discard the workout.')).toBeVisible()
  await page.getByRole('button', { name: 'Discard workout' }).click()

  await expect(page.getByRole('heading', { name: 'Resume your workout?' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
  await expect(page.getByRole('button', { name: templateName, exact: true })).toBeVisible()
})
