import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Covers docs/backlog.md item 1: numbered rows matching the exercise's
// configured set count, replacing the old one-set-at-a-time form. A
// template exercise with target_sets: 3 should show three rows together;
// logging one leaves the others visible and independently completable,
// including while that set's rest timer is running.
test('compact set rows: target_sets rows show together, log sequentially, stay editable during rest', async ({
  page,
  stamp,
}) => {
  const exerciseName = `E2E Compact Squat ${stamp}`
  const templateName = `E2E Compact Leg Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  const exerciseRow = page.locator('.row-wrap', { hasText: exerciseName })
  await exerciseRow.getByRole('button', { name: 'Edit exercise' }).click()
  await exerciseRow.getByLabel('Rest timer (seconds)').fill('30')
  await exerciseRow.getByRole('button', { name: 'Save' }).click()

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByPlaceholder('Sets').fill('3')
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row-wrap', { hasText: exerciseName })).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  // Three configured sets means three rows, visible together — and that
  // total stays three throughout (a logged row switches to a compact
  // read-only display rather than disappearing from the grid).
  const rows = page.locator('.set-row')
  const openRows = page.locator('.set-row-draft')
  await expect(rows).toHaveCount(3)
  await expect(openRows).toHaveCount(3)

  // Row 1: log it. Its own "Add set" is disabled until both fields have a
  // value (an empty planned row must never be saved).
  const firstRow = openRows.nth(0)
  await expect(firstRow.getByRole('button', { name: 'Add set' })).toBeDisabled()
  await firstRow.getByLabel('Reps').fill('8')
  await expect(firstRow.getByRole('button', { name: 'Add set' })).toBeDisabled()
  await firstRow.getByLabel('Weight').fill('185')
  await firstRow.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  // Rest starts for this exercise. Minimizing ("Back to workout") proves
  // rows 2 and 3 are still there and usable while it counts down, not just
  // present once rest ends.
  await expect(page.locator('.rest-headline')).toBeVisible()
  await page.getByRole('button', { name: 'Back to workout' }).click()
  await expect(page.getByText(/Resting \d:\d\d/)).toBeVisible()

  // Row 1 now shows as a done row; rows 2 and 3 remain open and numbered.
  await expect(rows).toHaveCount(3)
  await expect(openRows).toHaveCount(2)
  await expect(page.locator('.set-row-done', { hasText: '8 × 185lb' })).toBeVisible()

  // Row 2: log it while rest from row 1 is still running in the background.
  const secondRow = openRows.nth(0)
  await secondRow.getByLabel('Reps').fill('8')
  await secondRow.getByLabel('Weight').fill('185')
  await secondRow.getByRole('button', { name: 'Add set' }).click()

  // Logging row 2 restarts rest for this exercise (full-screen again).
  await expect(page.locator('.rest-headline')).toBeVisible()
  await page.getByRole('button', { name: 'Skip Rest' }).click()

  // Only row 3 is still open. Use its compact RPE expansion, then log it.
  await expect(openRows).toHaveCount(1)
  const thirdRow = openRows.nth(0)
  await thirdRow.getByRole('button', { name: '+RPE' }).click()
  await thirdRow.getByLabel('RPE (optional)').fill('9')
  await thirdRow.getByLabel('Reps').fill('6')
  await thirdRow.getByLabel('Weight').fill('195')
  await thirdRow.getByRole('button', { name: 'Add set' }).click()

  // Row 3 also starts rest — clear it before interacting with the grid again.
  await expect(page.locator('.rest-headline')).toBeVisible()
  await page.getByRole('button', { name: 'Skip Rest' }).click()

  // All three rows are now done — nothing left open in the grid, and the
  // full workout log below (unaffected by this item) shows all three,
  // including the RPE on the last one.
  await expect(rows).toHaveCount(3)
  await expect(openRows).toHaveCount(0)
  await expect(page.locator('li.row-wrap', { hasText: exerciseName })).toHaveCount(3)
  await expect(page.locator('li.row-wrap', { hasText: '6 × 195lb' })).toContainText('RPE 9')

  // Manual "+ Add row" for a fourth, unplanned set, then remove it again
  // (item 1's "allow adding or removing rows when the actual workout
  // differs from the configured count").
  await page.getByRole('button', { name: '+ Add row' }).click()
  await expect(rows).toHaveCount(4)
  await expect(openRows).toHaveCount(1)
  await openRows.nth(0).getByRole('button', { name: /Remove row/ }).click()
  await expect(rows).toHaveCount(3)
  await expect(openRows).toHaveCount(0)

  await page.getByRole('button', { name: 'Finish workout' }).click()
})
