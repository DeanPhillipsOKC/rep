import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { getAdminClient } from '../scripts/lib/mint-test-session.mjs'

// Covers docs/backlog.md item 9: a workout finished with zero sets logged
// must not leave a `workouts` row behind. Confirms via the admin client that
// the row is actually gone from the database, not just hidden from the UI.
test('finishing a workout with no sets deletes the workout row', async ({ page, stamp }) => {
  const notes = `E2E zero-set ${stamp}`

  await signInAsTestUser(page)

  await page.getByLabel('Notes (optional)').fill(notes)
  await page.getByRole('button', { name: 'Freeform' }).click()
  await page.getByRole('button', { name: 'Start workout' }).click()
  await page.getByRole('button', { name: 'Finish workout' }).click()

  // Backlog item 51: an empty finish now asks for confirmation before the
  // workout row gets discarded.
  await expect(page.getByText('Finish with no sets logged?')).toBeVisible()
  await page.getByRole('button', { name: 'Discard workout' }).click()

  await expect(page.getByRole('button', { name: 'Start workout' })).toBeVisible()

  const admin = getAdminClient()
  const { data, error } = await admin.from('workouts').select('id').eq('notes', notes)
  expect(error).toBeNull()
  expect(data).toEqual([])
})
