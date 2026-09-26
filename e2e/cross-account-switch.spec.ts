import { test, expect } from './fixtures/cleanup'
import { signInAsTestUser } from './fixtures/auth'
import { getAdminClient, mintSessionForEmail, deriveSecondaryEmail } from '../scripts/lib/mint-test-session.mjs'

// Item 84: reported by the user testing item 76 — sign out of the real
// account, sign back in with a passkey as a second account on the same
// device, and the Home progress strip briefly showed the *first* account's
// real workout data instead of the second (correctly empty) account's.
// Root-caused to `fetchProgressStats` (stores/workouts.ts) having no guard
// against a slow response from the account that was just signed out of
// landing after the newly-signed-in account's own (faster) fetch already
// rendered correctly — the exact "two overlapping onMounted fetches can
// resolve out of order" hazard `e2e/fixtures/auth.ts`'s `beforeNavigate`
// doc comment already calls out for this same function. There's no
// passkey to drive in a headless browser, so this simulates the account
// switch the same way a real passkey sign-in changes the session under the
// running app: `supabase.auth.setSession()` (exposed to the page for e2e
// only — see `src/lib/supabase.ts`), never a page reload, which would
// reset every Pinia store on its own and prove nothing about this bug.
test('switching accounts on the same device never shows the previous account\'s Home stats', async ({
  page,
  stamp,
}) => {
  const admin = getAdminClient()

  // This spec is the first to actually see the signed-out screen (every
  // other spec stays signed in for its whole run) — without this,
  // AuthGate.vue shows OnboardingScreen instead of LoginForm on a fresh
  // browser context, since `repbunny-onboarding-seen` was never set.
  await page.addInitScript(() => {
    localStorage.setItem('repbunny-onboarding-seen', '1')
  })

  // Gates only the first `workoutsThisWeek` count query (the one this
  // account's own initial Home mount fires) so it stays in flight across
  // the account switch below; every later matching request (the second
  // account's own mount fetch) is let through immediately.
  let gateCount = 0
  let releaseGate: () => void
  const gate = new Promise<void>((resolve) => {
    releaseGate = resolve
  })
  await page.route('**/rest/v1/workouts?select=performed_at*', async (route) => {
    gateCount += 1
    if (gateCount === 1) await gate
    await route.continue()
  })

  const userIdA = await signInAsTestUser(page)
  // A bare `workouts` row (no sets) is enough to move `workoutsThisWeek`
  // off zero; stamped in `notes` so the cleanup fixture's freeform-workout
  // match (scripts/lib/cleanup-e2e-stamp.mjs) finds and deletes it.
  await admin
    .from('workouts')
    .insert({ user_id: userIdA, performed_at: new Date().toISOString(), notes: `E2E Cross-Account ${stamp}` })

  // Confirms the app mounted signed in — its onMounted fetchProgressStats()
  // call is now stuck on the gate above.
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByLabel('Email')).toBeVisible()

  const secondAccountEmail = deriveSecondaryEmail(`e2e-x84-${stamp}`)
  const { session: sessionB } = await mintSessionForEmail(secondAccountEmail)

  // The progress strip only renders once the account has an active exercise
  // (docs/backlog-archive.md item 27's zero-exercise welcome card) — seed
  // one so the second account's (correctly empty) stat tile is actually on
  // screen to assert against. `exercises.user_id` has a not-null FK to
  // `profiles(id)` (supabase/schema.sql) and this account has never signed
  // in yet, so its profile row (normally created by auth.ts's ensureProfile
  // on first sign-in) has to be created here first.
  await admin.from('profiles').upsert({ id: sessionB.user.id })
  await admin.from('exercises').insert({ user_id: sessionB.user.id, name: `E2E Cross-Account Exercise ${stamp}` })

  try {
    await page.evaluate(
      async ({ accessToken, refreshToken }) => {
        const win = window as unknown as { __e2eSupabase: { auth: { setSession: (s: unknown) => Promise<unknown> } } }
        await win.__e2eSupabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      },
      { accessToken: sessionB.access_token, refreshToken: sessionB.refresh_token }
    )

    await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
    await expect(page.locator('.stat-tile-week .stat-value')).toHaveText('0')

    // Let the first account's stuck fetch finally resolve with its real
    // (nonzero) data and confirm it didn't land on top of the second
    // account's already-correct, already-rendered empty state.
    releaseGate!()
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.stat-tile-week .stat-value')).toHaveText('0')
  } finally {
    // Manual teardown: this is a one-off synthetic identity, not the
    // per-worker account e2e/fixtures/auth.ts reuses run over run, so it
    // must not survive the test — `profiles`/`exercises` reference
    // `auth.users` without cascading (supabase/schema.sql), so deleting the
    // user first would fail with a foreign-key violation.
    await admin.from('exercises').delete().eq('user_id', sessionB.user.id)
    await admin.from('profiles').delete().eq('id', sessionB.user.id)
    await admin.auth.admin.deleteUser(sessionB.user.id)
  }
})
