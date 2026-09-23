#!/usr/bin/env node
// CLI wrapper around scripts/lib/mint-test-session.mjs. Mints a real Supabase
// session for a designated test account, for browser/E2E automation. Real
// auth is passkey + magic-link only — neither is scriptable — so this uses
// the service-role Admin API to generate a magic-link token and immediately
// redeem it, exactly like a user clicking the email link would.
// See docs/architecture.md#authentication and docs/backlog-archive.md.
//
// Usage:
//   npm run test:session
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY, and
// TEST_ACCOUNT_EMAIL from .env.local (never commit the service role key —
// .env.local is already gitignored). Prints JSON with the localStorage key
// and session value a browser automation script should inject before loading
// the app, e.g. (Playwright):
//
//   const { storageKey, session } = JSON.parse(scriptOutput)
//   await page.addInitScript(([key, value]) => {
//     localStorage.setItem(key, value)
//   }, [storageKey, JSON.stringify(session)])
//   await page.goto('http://localhost:5173')
//
// The app's own auth store picks the session up via supabase.auth.getSession()
// on load and creates the profiles row as usual — no extra setup needed.
//
// For Playwright specifically, use e2e/fixtures/auth.ts instead of shelling
// out to this script — it imports the same mintTestSession() directly.

import { mintTestSession } from './lib/mint-test-session.mjs'

try {
  const result = await mintTestSession()
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  console.error(`create-test-session: ${err.message}`)
  process.exit(1)
}
