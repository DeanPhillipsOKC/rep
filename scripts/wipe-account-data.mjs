#!/usr/bin/env node
// On-demand data wipe for a single account, for repeated manual/exploratory
// test scenarios that would otherwise accumulate stale data. Not wired into
// the UI. See docs/backlog.md item 5.
//
// Usage:
//   npm run wipe:account -- <email-or-user-id>
//
// Requires an explicit email or user id argument and refuses to run without
// one, so it can never become a blanket wipe touching more than one account.
// Uses the service-role key (see docs/architecture.md#client-security) —
// same .env.local-only handling as scripts/create-test-session.mjs.
//
// Deletes workouts (cascades to sets), workout_templates (cascades to
// workout_template_exercises), and exercises for the resolved user. Leaves
// the auth user and profiles row intact — only workout data is cleared.

import { getAdminClient } from './lib/mint-test-session.mjs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function resolveUser(admin, target) {
  if (UUID_RE.test(target)) {
    const { data, error } = await admin.auth.admin.getUserById(target)
    if (error || !data?.user) throw new Error(`No user found with id ${target}`)
    return data.user
  }

  const perPage = 200
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const match = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase())
    if (match) return match
    if (data.users.length < perPage) break
  }
  throw new Error(`No user found with email ${target}`)
}

async function wipe() {
  const target = process.argv[2]
  if (!target) {
    throw new Error(
      'Usage: npm run wipe:account -- <email-or-user-id>\n' +
        'Refuses to run without an explicit account identifier.'
    )
  }

  const admin = getAdminClient()
  const user = await resolveUser(admin, target)

  console.log(`Wiping workout data for ${user.email} (${user.id})...`)

  // Order matters: workouts.template_id and sets.exercise_id /
  // workout_template_exercises.exercise_id have no cascading delete, so
  // dependents must go before the tables they reference.
  const tables = ['workouts', 'workout_templates', 'exercises']
  for (const table of tables) {
    const { error, count } = await admin.from(table).delete({ count: 'exact' }).eq('user_id', user.id)
    if (error) throw new Error(`Failed deleting from ${table}: ${error.message}`)
    console.log(`  ${table}: deleted ${count ?? 0} row(s)`)
  }

  console.log('Done. Account and profile row left intact.')
}

try {
  await wipe()
} catch (err) {
  console.error(`wipe-account-data: ${err.message}`)
  process.exit(1)
}
