import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

test('set row steppers adjust values while inputs remain editable and RPE stays clear of Add set', async ({ page, stamp }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  const exerciseName = `E2E Stepper ${stamp}`
  await signInAsTestUser(page)
  await goTo(page, 'Exercises')
  await page.getByLabel('Name').fill(exerciseName)
  await page.getByRole('button', { name: 'Add exercise' }).click()
  await goTo(page, 'Home')
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByLabel('Exercise').selectOption({ label: exerciseName })

  const row = page.locator('.set-row-draft').first()
  const reps = row.getByLabel('Reps')
  const weight = row.getByLabel('Weight')
  await row.getByRole('button', { name: 'Increase set 1 rep count' }).click()
  await expect(reps).toHaveValue('1')
  await row.getByRole('button', { name: 'Increase set 1 rep count' }).click()
  await expect(reps).toHaveValue('2')
  await row.getByRole('button', { name: 'Decrease set 1 rep count' }).click()
  await expect(reps).toHaveValue('1')
  await expect(row.getByRole('button', { name: 'Decrease set 1 rep count' })).toBeDisabled()

  await weight.fill('95')
  await expect(weight).toBeFocused()
  await row.getByRole('button', { name: 'Increase set 1 load by 10 lb' }).click()
  await expect(weight).toHaveValue('105')
  await row.getByRole('button', { name: 'Decrease set 1 load by 10 lb' }).click()
  await expect(weight).toHaveValue('95')
  await page.getByRole('button', { name: 'kg', exact: true }).click()
  await row.getByRole('button', { name: 'Increase set 1 load by 5 kg' }).click()
  await expect(weight).toHaveValue('100')
  await row.getByRole('button', { name: 'Decrease set 1 load by 5 kg' }).click()
  await expect(weight).toHaveValue('95')
  await reps.fill('7')
  await expect(reps).toBeFocused()

  await row.getByRole('button', { name: '+RPE' }).click()
  const rpe = row.getByLabel('RPE (optional)')
  await expect(rpe).toBeVisible()
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 720 })
    const geometry = await row.evaluate((element) => {
      const bounds = element.getBoundingClientRect()
      const rpeBounds = element.querySelector('.set-input-rpe')!.getBoundingClientRect()
      const addBounds = element.querySelector('.log-btn')!.getBoundingClientRect()
      return {
        withinRow: rpeBounds.left >= bounds.left && rpeBounds.right <= bounds.right && addBounds.right <= bounds.right,
        separated: rpeBounds.right + 4 <= addBounds.left || rpeBounds.bottom + 4 <= addBounds.top || addBounds.bottom + 4 <= rpeBounds.top,
      }
    })
    expect(geometry.withinRow).toBe(true)
    expect(geometry.separated).toBe(true)
  }
})
