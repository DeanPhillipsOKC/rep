import { test, expect } from '@playwright/test'
import { signInAsTestUser } from './fixtures/auth'
import { goTo } from './fixtures/nav'

// Covers docs/backlog.md item 41: the persistent bottom tab bar that
// replaced the hamburger-drawer nav (item 18). Checks the bar is always
// present, every tab navigates to its route, and the active tab is marked
// current for assistive tech (router-link's default aria-current="page").
test('bottom nav: all four tabs are always visible and navigate to their screen', async ({ page }) => {
  await signInAsTestUser(page)

  const nav = page.getByRole('navigation', { name: 'Primary' })
  await expect(nav).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')

  await goTo(page, 'History')
  await expect(page).toHaveURL(/\/history$/)
  await expect(nav.getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current', 'page')

  await goTo(page, 'Templates')
  await expect(page).toHaveURL(/\/templates$/)
  await expect(nav.getByRole('link', { name: 'Templates' })).toHaveAttribute('aria-current', 'page')

  await goTo(page, 'Exercises')
  await expect(page).toHaveURL(/\/exercises$/)
  await expect(nav.getByRole('link', { name: 'Exercises' })).toHaveAttribute('aria-current', 'page')

  await goTo(page, 'Home')
  await expect(page).toHaveURL(/\/$/)
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page')
})
