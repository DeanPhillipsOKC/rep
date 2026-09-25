import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

test('shows the login form when signed out', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: /let's hop in/i }).click()
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible()
})

test('page title carries the build version', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/^RepBunny v\d+\+[0-9a-f]{7,}/)
})

test('build version is visible on-page, not just in the title', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('footer.app-version')).toHaveText(/^v\d+\+[0-9a-f]{7,}/)
})

test('loads signed in when a test session is injected', async ({ page }) => {
  await signInAsTestUser(page)
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})
