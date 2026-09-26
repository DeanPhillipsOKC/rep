#!/usr/bin/env node
// Structural fix for backlog item 58 (docs/backlog-archive.md): item 57's
// per-test cleanup fixture (e2e/fixtures/cleanup.ts) only deletes a test's
// stamped rows on that test's own teardown, which never runs if the whole
// `playwright test` process is killed or times out mid-run — confirmed by
// force-killing a running spec mid-test and observing its stamped exercise
// row survive untouched. This script doesn't depend on graceful teardown at
// all: every E2E-stamped row's own name/notes already embeds a
// `Date.now()`-based stamp (the `E2E <thing> <stamp>` naming convention), so
// this reads that stamp back out, and deletes anything older than a
// threshold well past any single test run — no separate created_at tracking
// needed.
//
// Usage:
//   npm run sweep:e2e-stale [-- --minutes=60]
//
// Safe to run anytime, including with nothing to sweep (no-op) or against a
// clean account. Reuses scripts/lib/cleanup-e2e-stamp.mjs's per-stamp
// cascade-safe deletion (workouts, then templates, then exercises) so a
// stamp swept here is deleted exactly the way the fixture itself would have
// deleted it.
import { getAdminClient } from './lib/mint-test-session.mjs'
import { cleanupStamp } from './lib/cleanup-e2e-stamp.mjs'

const DEFAULT_THRESHOLD_MINUTES = 60

function parseThresholdMinutes(argv) {
  const flag = argv.find((a) => a.startsWith('--minutes='))
  if (!flag) return DEFAULT_THRESHOLD_MINUTES
  const value = Number(flag.slice('--minutes='.length))
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`--minutes must be a positive number, got: ${flag}`)
  }
  return value
}

// Every spec names/notes its stamped rows `E2E <words> <stamp>` where
// <stamp> is `Date.now() + Math.floor(Math.random() * 1000)` — a trailing
// run of digits is always that stamp. Rows matching `%E2E%` but with no
// trailing digits don't fit the convention and are left alone rather than
// guessed at.
function extractStamp(text) {
  const match = /(\d+)\s*$/.exec(text ?? '')
  return match ? Number(match[1]) : null
}

async function collectStamps(admin) {
  const stamps = new Map() // stamp -> { source, sample }

  const { data: exercises } = await admin.from('exercises').select('name').ilike('name', '%E2E%')
  for (const row of exercises ?? []) {
    const stamp = extractStamp(row.name)
    if (stamp !== null) stamps.set(stamp, { source: 'exercises', sample: row.name })
  }

  const { data: templates } = await admin.from('workout_templates').select('name').ilike('name', '%E2E%')
  for (const row of templates ?? []) {
    const stamp = extractStamp(row.name)
    if (stamp !== null) stamps.set(stamp, { source: 'workout_templates', sample: row.name })
  }

  const { data: workouts } = await admin.from('workouts').select('notes').ilike('notes', '%E2E%')
  for (const row of workouts ?? []) {
    const stamp = extractStamp(row.notes)
    if (stamp !== null) stamps.set(stamp, { source: 'workouts', sample: row.notes })
  }

  return stamps
}

async function sweep() {
  const thresholdMinutes = parseThresholdMinutes(process.argv.slice(2))
  const thresholdMs = thresholdMinutes * 60_000
  const now = Date.now()

  const admin = getAdminClient()
  const stamps = await collectStamps(admin)

  const stale = [...stamps.entries()].filter(([stamp]) => now - stamp > thresholdMs)
  const fresh = stamps.size - stale.length

  console.log(
    `sweep-stale-e2e-rows: ${stamps.size} E2E-stamped row(s) found, ${stale.length} older than ${thresholdMinutes}m, ${fresh} within threshold (left alone).`
  )

  let swept = 0
  for (const [stamp, info] of stale) {
    const ageMinutes = Math.round((now - stamp) / 60_000)
    const counts = await cleanupStamp(stamp)
    console.log(
      `  swept stamp ${stamp} (${ageMinutes}m old, e.g. "${info.sample}"): ` +
        `${counts.exercises} exercise(s), ${counts.workout_templates} template(s), ${counts.workouts} workout(s)`
    )
    swept++
  }

  console.log(`sweep-stale-e2e-rows: done, swept ${swept} stale stamp(s).`)
}

try {
  await sweep()
} catch (err) {
  console.error(`sweep-stale-e2e-rows: ${err.message}`)
  process.exit(1)
}
