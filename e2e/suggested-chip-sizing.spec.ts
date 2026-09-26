import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 1 (jagged .suggested chip sizing): the
// mid-workout exercise quick-select chips previously sized to each
// exercise's own text with no bound, so a template mixing short and long
// names produced a ragged, unevenly wrapped row. Chips must now sit within
// a consistent min/max width, truncate long names with an ellipsis, and
// still expose the full name (via `title`) for accessibility.
test('mid-workout exercise chips truncate long names and keep short ones legible', async ({ page, stamp }) => {
  const shortName = `E2E Row ${stamp}`
  const longName = `E2E Very Long Exercise Name That Should Truncate ${stamp}`
  const templateName = `E2E Chip Sizing ${stamp}`

  await signInAsTestUser(page)

  await goTo(page, 'Exercises')
  for (const name of [shortName, longName]) {
    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await expect(page.getByText(name)).toBeVisible()
  }

  await goTo(page, 'Templates')
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByLabel('Name').fill(templateName)
  await page.getByRole('button', { name: 'Add template' }).click()
  await page.getByText(templateName).click()
  for (const name of [shortName, longName]) {
    await page.getByRole('combobox').selectOption({ label: name })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    // Wait for this insert to land before selecting the next exercise --
    // the add form resets `exerciseId` once its request resolves, which
    // would otherwise race a same-tick selection of the next exercise.
    await expect(page.locator('.exercise-row', { hasText: name })).toBeVisible()
  }

  await goTo(page, 'Home')
  await page.getByRole('button', { name: templateName, exact: true }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()

  const shortChip = page.locator('.suggested .chip', { hasText: shortName })
  const longChip = page.locator('.suggested .chip', { hasText: longName })
  await expect(shortChip).toBeVisible()
  await expect(longChip).toBeVisible()

  // Full names stay available even when the visible label is truncated.
  await expect(shortChip).toHaveAttribute('title', shortName)
  await expect(longChip).toHaveAttribute('title', longName)

  const shortBox = await shortChip.boundingBox()
  const longBox = await longChip.boundingBox()
  expect(shortBox?.width).toBeGreaterThanOrEqual(90)
  expect(longBox?.width).toBeLessThanOrEqual(140)

  const longChipStyle = await longChip.evaluate((el) => {
    const style = getComputedStyle(el)
    return { overflow: style.overflow, textOverflow: style.textOverflow, whiteSpace: style.whiteSpace }
  })
  expect(longChipStyle.overflow).toBe('hidden')
  expect(longChipStyle.textOverflow).toBe('ellipsis')
  expect(longChipStyle.whiteSpace).toBe('nowrap')

  await page.getByRole('button', { name: 'Finish workout' }).click()
  await page.getByRole('button', { name: 'Discard workout' }).click()
})
