import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'
import { dismissCelebrationIfShown } from './fixtures/celebration'

// Found 2026-09-24 while manually testing: v-model.number leaves an emptied
// <input type="number"> as '' rather than coercing it to null, and RPE/target
// sets are the only numeric fields in the app without a `required` guard
// forcing a real value first. Sending that '' straight to a Postgres numeric
// column threw "invalid input syntax for type numeric" and silently dropped
// the add/edit. Covers both call sites that hit it: adding a set with RPE
// left blank, and adding/editing a template exercise with target sets left
// blank.
test('adding a set with RPE left blank does not error', async ({ page, stamp }) => {
  const exerciseName = `E2E Blank Optional ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })
  await page.getByLabel('Reps').fill('10')
  await page.getByLabel('Weight').fill('45')
  await page.getByRole('button', { name: 'Add set' }).click()
  await dismissCelebrationIfShown(page)

  const row = page.locator('li.row-wrap', { hasText: exerciseName })
  await expect(row).toBeVisible()
  await expect(row).toContainText('10 × 45lb')
  await expect(page.getByText('invalid input syntax')).toHaveCount(0)

  // Editing back to no RPE after it had one must also not error.
  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('RPE (optional)').fill('7')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row).toContainText('RPE 7')

  await row.getByRole('button', { name: 'Edit' }).click()
  await row.getByLabel('RPE (optional)').fill('')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row).not.toContainText('RPE 7')
  await expect(page.getByText('invalid input syntax')).toHaveCount(0)
})

test('adding a template exercise with target sets left blank does not error', async ({ page, stamp }) => {
  const exerciseName = `E2E No Target ${stamp}`
  const templateName = `E2E Blank Sets ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await expect(page.getByText(exerciseName)).toBeVisible()

  await goTo(page, 'Templates')
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: exerciseName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  const row = page.locator('.exercise-row', { hasText: exerciseName })
  await expect(row).toBeVisible()
  await expect(page.getByText('invalid input syntax')).toHaveCount(0)
})
