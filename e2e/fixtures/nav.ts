import type { Page } from '@playwright/test'

// Navigation lives in the persistent bottom tab bar (docs/backlog.md item 41,
// replacing the hamburger-menu drawer, item 18). Tests click a tab link
// directly instead of opening a menu first.
export async function goTo(page: Page, view: 'Home' | 'Exercises' | 'Templates' | 'History') {
  await page.getByRole('link', { name: view, exact: true }).click()
}
