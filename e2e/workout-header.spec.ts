import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 50: WorkoutLogger.vue's heading used to read
// "Log a workout" whether or not a workout was active, with no elapsed-time
// indication. Also covers item 67's carousel: its dot row and exercise card
// stay in sync -- picking a dot highlights it and updates the card's name.
test('active workout shows a dynamic header, and the exercise carousel stays in sync', async ({ page, stamp }) => {
  const exerciseAName = `E2E Bench ${stamp}`
  const exerciseBName = `E2E Row ${stamp}`
  const templateName = `E2E Push Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  for (const name of [exerciseAName, exerciseBName]) {
    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(page.getByText(name)).toBeVisible()
  }

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  for (const name of [exerciseAName, exerciseBName]) {
    await page.getByRole('combobox').selectOption({ label: name })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await expect(page.locator('.exercise-row', { hasText: name })).toBeVisible()
  }

  await goTo(page, 'Home')

  // Before starting: static heading, no elapsed clock.
  await expect(page.getByRole('heading', { name: 'Log a workout' })).toBeVisible()
  await expect(page.locator('.elapsed-time')).toHaveCount(0)

  // Freeform workout: heading falls back to "Freeform workout" and a
  // ticking mm:ss clock appears.
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(page.getByRole('heading', { name: 'Freeform workout' })).toBeVisible()
  const elapsed = page.locator('.elapsed-time')
  await expect(elapsed).toBeVisible()
  await expect(elapsed).toHaveText(/^\d{2}:\d{2}$/)
  const firstReading = await elapsed.textContent()
  await expect(elapsed).not.toHaveText(firstReading ?? '', { timeout: 5000 })

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()

  // Templated workout: heading shows the template's name.
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(page.getByRole('heading', { name: templateName, exact: true })).toBeVisible()

  const dotA = page.getByRole('button', { name: exerciseAName, exact: true })
  const dotB = page.getByRole('button', { name: exerciseBName, exact: true })
  const cardName = page.locator('.exercise-card-name')

  // Picking a dot highlights it and updates the exercise card.
  await dotA.click()
  await expect(dotA).toHaveAttribute('aria-pressed', 'true')
  await expect(dotB).toHaveAttribute('aria-pressed', 'false')
  await expect(cardName).toHaveText(exerciseAName)

  // Picking the other dot flips the highlight -- the two stay in sync.
  await dotB.click()
  await expect(dotB).toHaveAttribute('aria-pressed', 'true')
  await expect(dotA).toHaveAttribute('aria-pressed', 'false')
  await expect(cardName).toHaveText(exerciseBName)
})
