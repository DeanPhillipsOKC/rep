import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md's "Let an accidentally-finished workout be resumed"
// item: tapping "Finish workout" used to be a one-way door the moment any
// set existed (docs/backlog-archive.md item 51 only guards the zero-sets
// case). These specs drive the real "Finish workout" button (not a reload,
// unlike resume-workout.spec.ts's crash-recovery specs) and check the
// post-finish "Resume your workout?" offer it should now show.

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
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
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

  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('8')
  await page.getByLabel('Weight').fill('105')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await expect(page.locator('li.row-wrap', { hasText: '8 × 105lb' })).toBeVisible()

  await page.getByRole('button', { name: 'Finish workout' }).click()
})

test('resume after finish: templated workout offers resume after the volume chart, and Start a new workout dismisses it', async ({
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

  // A templated workout with sets shows the volume chart first — the resume
  // offer isn't gated inside it, it just comes right after.
  await expect(page.getByRole('heading', { name: 'Volume over time' })).toBeVisible()
  await page.getByRole('button', { name: 'Log another workout' }).click()

  const prompt = page.locator('.card', { hasText: 'Resume your workout?' })
  await expect(prompt).toBeVisible()
  await expect(prompt).toContainText(templateName)
  await expect(prompt).toContainText('1 set logged')

  await page.getByRole('button', { name: 'Start a new workout' }).click()

  // Dismissing is non-destructive: the finished workout and its set stay
  // exactly as finished, just no longer offered as resumable. Back at the
  // normal start screen, nothing's pre-selected (item 1's explicit-choice
  // requirement), so Start workout is present but disabled again.
  await expect(prompt).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start workout' })).toBeDisabled()

  await goTo(page, 'History')
  const card = page.locator('.card', { hasText: templateName })
  await expect(card).toBeVisible()
  await expect(card.locator('li.row-wrap')).toContainText('5 × 225lb')
})

test('resume after finish: finishing with no sets logged does not offer to resume', async ({ page, stamp }) => {
  const templateName = `E2E ResumeFinish Empty ${stamp}`

  await signInAsTestUser(page)

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
