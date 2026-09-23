import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'

test('shows the login form when signed out', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByLabel('Email')).toBeVisible()
  await expect(page.getByRole('button', { name: /sign out/i })).not.toBeVisible()
})

test('loads signed in when a test session is injected', async ({ page }) => {
  await signInAsTestUser(page)
  await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})
