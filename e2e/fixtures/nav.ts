import type { Page } from '@playwright/test'

// Navigation moved from an always-visible tab row into the hamburger-menu
// drawer (docs/backlog.md item 18). Tests open the menu, then pick a
// destination, instead of clicking a tab button directly.
export async function goTo(page: Page, view: 'Log' | 'Exercises' | 'Templates' | 'History') {
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.getByRole('button', { name: view, exact: true }).click()
}
