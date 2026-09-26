// Core logic for minting a real Supabase session for the designated test
// account. Shared by scripts/create-test-session.mjs (CLI) and the Playwright
// e2e auth fixture (e2e/fixtures/auth.ts) — see docs/architecture.md#testing--automation.

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// The two real allowlisted accounts (docs/backlog-archive.md#decisions-made).
// This must never be used to mint sessions for them.
const REAL_ACCOUNT_EMAILS = new Set([
  'dephillips1977@gmail.com',
  'christashouse@hotmail.com',
])

function loadEnvLocal() {
  let contents
  try {
    contents = readFileSync(new URL('../../.env.local', import.meta.url), 'utf8')
  } catch {
    return
  }
  for (const line of contents.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const value = trimmed.slice(eq + 1).trim()
    if (process.env[key] === undefined) process.env[key] = value
  }
}

// Shared by the e2e suite (e2e/fixtures/auth.ts) to inspect/clean up rows the
// test account creates, using the same service-role credentials as session
// minting — never used against the real allowlisted accounts (see
// REAL_ACCOUNT_EMAILS above).
export function getAdminClient() {
  loadEnvLocal()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not set.')
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local only — never commit it, ' +
        'never put it in Cloudflare Pages env vars (see docs/architecture.md#client-security).'
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Backlog item 82: with more than one Playwright worker, every worker minting
// sessions for the *same* test account races the same magic link and trips
// progress-strip.spec.ts's "nobody else changes this account's workout
// count" assumption. Each worker gets its own dedicated account instead,
// derived from TEST_ACCOUNT_EMAIL via Gmail-style plus-addressing (Supabase
// treats `local+suffix@domain` as a fully separate auth identity from
// `local@domain` -- same trick as the human-only "fresh test account" setup
// task in docs/backlog.md -- and generateLink auto-creates the account on
// first use, so no manual account provisioning is needed per worker).
// Playwright sets TEST_PARALLEL_INDEX per worker process (stable across
// retries, unlike TEST_WORKER_INDEX); it's absent for the CLI script
// (`npm run test:session`), which keeps using the bare account unchanged.
function deriveWorkerEmail(baseEmail) {
  const parallelIndex = process.env.TEST_PARALLEL_INDEX
  if (parallelIndex === undefined) return baseEmail
  const at = baseEmail.indexOf('@')
  if (at === -1) return baseEmail
  return `${baseEmail.slice(0, at)}+e2e-w${parallelIndex}${baseEmail.slice(at)}`
}

// Item 84: a one-off second identity for specs that need to reproduce an
// actual account switch, distinct from the per-worker account above (which
// is reused run over run, not meant to be swapped away from mid-test). Same
// plus-addressing trick; `suffix` is the caller's to make unique (e.g. the
// cleanup fixture's stamp) so concurrent runs/workers never collide. Kept in
// this module (rather than inline in the spec) so the `.ts` spec doesn't
// need its own `process.env`/Node typing.
export function deriveSecondaryEmail(suffix) {
  loadEnvLocal()
  const testEmail = process.env.TEST_ACCOUNT_EMAIL
  if (!testEmail) {
    throw new Error('TEST_ACCOUNT_EMAIL is not set.')
  }
  const at = testEmail.indexOf('@')
  if (at === -1) return testEmail
  return `${testEmail.slice(0, at)}+${suffix}${testEmail.slice(at)}`
}

const isRateLimited = (message) => /rate limit/i.test(message ?? '')

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// generateLink/verifyOtp share GoTrue's OTP-issuing rate limit (docs/backlog-archive.md
// item 56) — back-to-back full-suite runs can trip it even though each individual mint
// is well-spaced within one run. A couple of short retries clears a transient blip
// without eating much of Playwright's 30s per-test timeout; a limit that's still hot
// after that needs an actual wait, which this deliberately doesn't do.
const RETRY_DELAYS_MS = [2000, 6000]

async function withRateLimitRetry(label, fn) {
  for (let attempt = 0; ; attempt++) {
    const { data, error } = await fn()
    if (!error) return data
    if (attempt >= RETRY_DELAYS_MS.length || !isRateLimited(error.message)) {
      throw new Error(`${label} failed: ${error.message}`)
    }
    await sleep(RETRY_DELAYS_MS[attempt])
  }
}

// Item 84's cross-account e2e spec needs a *second*, genuinely distinct test
// identity on demand (not just this worker's own dedicated account) to
// reproduce a same-device account switch — split out from mintTestSession so
// it can mint one for an arbitrary plus-addressed email without duplicating
// the generateLink/verifyOtp plumbing. Still refuses either real allowlisted
// account, same as mintTestSession itself.
export async function mintSessionForEmail(email) {
  loadEnvLocal()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  if (!supabaseUrl) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not set.')
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY is not set.')
  if (REAL_ACCOUNT_EMAILS.has(email.toLowerCase())) {
    throw new Error(`Refusing to mint a session for a real allowlisted account (${email}).`)
  }

  const admin = getAdminClient()

  const linkData = await withRateLimitRetry('generateLink', () =>
    admin.auth.admin.generateLink({ type: 'magiclink', email })
  )

  const hashedToken = linkData.properties?.hashed_token
  if (!hashedToken) throw new Error('generateLink response had no hashed_token.')

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const verifyData = await withRateLimitRetry('verifyOtp', () =>
    anon.auth.verifyOtp({ token_hash: hashedToken, type: 'email' })
  )
  if (!verifyData.session) throw new Error('verifyOtp did not return a session.')

  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const storageKey = `sb-${projectRef}-auth-token`

  return { storageKey, session: verifyData.session }
}

export async function mintTestSession() {
  loadEnvLocal()

  const testEmail = process.env.TEST_ACCOUNT_EMAIL
  if (!testEmail) {
    throw new Error(
      'TEST_ACCOUNT_EMAIL is not set. Point it at a dedicated test account, not either real ' +
        'allowlisted user.'
    )
  }
  if (REAL_ACCOUNT_EMAILS.has(testEmail.toLowerCase())) {
    throw new Error(`TEST_ACCOUNT_EMAIL (${testEmail}) is one of the real allowlisted accounts. Refusing.`)
  }

  const workerEmail = deriveWorkerEmail(testEmail)
  return mintSessionForEmail(workerEmail)
}
