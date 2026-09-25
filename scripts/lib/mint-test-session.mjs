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

export async function mintTestSession() {
  loadEnvLocal()

  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  const testEmail = process.env.TEST_ACCOUNT_EMAIL

  if (!supabaseUrl) throw new Error('SUPABASE_URL (or VITE_SUPABASE_URL) is not set.')
  if (!anonKey) throw new Error('VITE_SUPABASE_ANON_KEY is not set.')
  if (!testEmail) {
    throw new Error(
      'TEST_ACCOUNT_EMAIL is not set. Point it at a dedicated test account, not either real ' +
        'allowlisted user.'
    )
  }
  if (REAL_ACCOUNT_EMAILS.has(testEmail.toLowerCase())) {
    throw new Error(`TEST_ACCOUNT_EMAIL (${testEmail}) is one of the real allowlisted accounts. Refusing.`)
  }

  const admin = getAdminClient()

  const linkData = await withRateLimitRetry('generateLink', () =>
    admin.auth.admin.generateLink({ type: 'magiclink', email: testEmail })
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
