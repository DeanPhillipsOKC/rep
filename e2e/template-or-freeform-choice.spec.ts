import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md's "require a conscious template-or-freeform choice"
// item: the start screen's templateId used to default to '' (Freeform) with
// the Freeform chip rendered pre-selected, so tapping "Start workout" without
// touching anything silently started a freeform workout. Now nothing is
// selected until the user picks a chip, and "Start workout" stays disabled
// until they do.
test('start screen requires an explicit template-or-freeform pick before Start workout is enabled', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E Choice Squat ${stamp}`
  const templateName = `E2E Choice Day ${stamp}`

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

  const startButton = page.getByRole('button', { name: 'Start workout' })
  const freeformChip = page.getByRole('button', { name: 'Freeform' })
  const templateChip = page.getByRole('button', { name: templateName, exact: true })

  // Nothing selected yet: neither chip shows as active, and submitting is
  // blocked rather than silently defaulting to freeform.
  await expect(freeformChip).not.toHaveClass(/chip-selected/)
  await expect(templateChip).not.toHaveClass(/chip-selected/)
  await expect(startButton).toBeDisabled()

  // Picking Freeform is a deliberate, visible choice that enables the button.
  await freeformChip.click()
  await expect(freeformChip).toHaveClass(/chip-selected/)
  await expect(startButton).toBeEnabled()

  // Switching to a template re-highlights the chip and keeps the button enabled.
  await templateChip.click()
  await expect(templateChip).toHaveClass(/chip-selected/)
  await expect(freeformChip).not.toHaveClass(/chip-selected/)
  await expect(startButton).toBeEnabled()

  await startButton.click()
  await expect(page.getByRole('heading', { name: templateName, exact: true })).toBeVisible()
  await page.getByRole('button', { name: exerciseName, exact: true }).click()
  await page.getByLabel('Reps').fill('5')
  await page.getByLabel('Weight').fill('135')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // A templated finish with sets logged shows the volume-chart card before
  // returning to the start screen.
  await page.getByRole('button', { name: 'Log another workout' }).click()

  // Reached fresh after finishing: unselected again, not carried over from
  // the just-finished (templated) workout.
  await expect(freeformChip).not.toHaveClass(/chip-selected/)
  await expect(templateChip).not.toHaveClass(/chip-selected/)
  await expect(startButton).toBeDisabled()

  await freeformChip.click()
  await startButton.click()
  await expect(page.getByRole('heading', { name: 'Freeform workout' })).toBeVisible()
  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
})
