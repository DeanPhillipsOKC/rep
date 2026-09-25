import { test, expect } from '@playwright/test'

test('shows onboarding on first launch, then the login form after continuing', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.getByRole('button', { name: /let's hop in/i })).toBeVisible()
  await expect(page.getByLabel('Email')).not.toBeVisible()

  await page.getByRole('button', { name: /let's hop in/i }).click()
  await expect(page.getByLabel('Email')).toBeVisible()
})

test('does not show onboarding again once it has been seen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /let's hop in/i }).click()
  await expect(page.getByLabel('Email')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: /let's hop in/i })).not.toBeVisible()
})
