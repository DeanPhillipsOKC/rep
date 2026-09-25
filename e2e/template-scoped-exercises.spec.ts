import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 21: the exercise dropdown in an active,
// templated workout must only offer that template's exercises, not every
// exercise the user has — otherwise an ad-hoc addition (picked from the
// dropdown rather than a suggested chip) leaks into that template's
// reporting (the "last time" card, the post-workout volume chart).
test('exercise dropdown is scoped to the active template', async ({ page, stamp }) => {
  const inTemplateName = `E2E Row ${stamp}`
  const notInTemplateName = `E2E Lunge ${stamp}`
  const templateName = `E2E Pull Day ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  for (const name of [inTemplateName, notInTemplateName]) {
    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(page.getByText(name)).toBeVisible()
  }

  await goTo(page, 'Templates')
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  await page.getByRole('combobox').selectOption({ label: inTemplateName })
  await page.getByRole('button', { name: 'Add', exact: true }).click()
  await expect(page.locator('.exercise-row', { hasText: inTemplateName })).toBeVisible()

  // Freeform (no template): the dropdown offers every active exercise.
  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  const exerciseSelect = page.getByLabel('Exercise')
  await expect(exerciseSelect.getByRole('option', { name: inTemplateName })).toHaveCount(1)
  await expect(exerciseSelect.getByRole('option', { name: notInTemplateName })).toHaveCount(1)
  await page.getByRole('button', { name: 'Finish workout' }).click()
  // Backlog item 51: finishing with no sets logged now confirms before discarding.
  await page.getByRole('button', { name: 'Discard workout' }).click()

  // Templated: only the template's exercise is offered.
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await expect(exerciseSelect.getByRole('option', { name: inTemplateName })).toHaveCount(1)
  await expect(exerciseSelect.getByRole('option', { name: notInTemplateName })).toHaveCount(0)
})
