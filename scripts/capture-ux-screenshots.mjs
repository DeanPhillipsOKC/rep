#!/usr/bin/env node
// Drives the app through onboarding, a normal logging session, and the
// exercise/template management ("administrative") screens on a mobile
// viewport, saving a screenshot at each meaningful state for the ux-review
// skill (.claude/skills/ux-review/SKILL.md) to look at. Not part of the
// npm run test:e2e gate — this makes no assertions, it only captures state.
//
// Requires the dev server already running (npm run dev) and .env.local
// populated the same way e2e/ needs it (TEST_ACCOUNT_EMAIL,
// SUPABASE_SERVICE_ROLE_KEY — see docs/architecture.md#testing--automation).
// Everything this script creates is stamped `E2E UX Review <stamp>` and
// deleted again via the admin client before it exits, same convention as
// e2e/fixtures/cleanup.ts, so repeat runs never accumulate rows on the
// shared test account.
//
// Usage: node scripts/capture-ux-screenshots.mjs

import { chromium, devices } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { mintTestSession, getAdminClient } from './lib/mint-test-session.mjs'

const BASE_URL = 'http://localhost:5173'
const stamp = Date.now()
const outDir = join('logs', 'ux-review', String(stamp))
mkdirSync(outDir, { recursive: true })

const manifest = []
let shotIndex = 0

async function shot(page, label) {
  shotIndex += 1
  const file = `${String(shotIndex).padStart(2, '0')}-${label}.png`
  await page.screenshot({ path: join(outDir, file), fullPage: true })
  manifest.push({ file, label })
}

// After "Add set", either the record-celebration overlay or the rest-timer
// overlay (or neither) can appear and block further clicks until dismissed.
// Screenshot whichever shows up — both are real screens worth reviewing —
// then dismiss it before the caller's next action.
async function dismissOverlaysIfShown(page) {
  const celebration = page.locator('.celebration-overlay')
  try {
    await celebration.waitFor({ state: 'visible', timeout: 2000 })
    await shot(page, 'record-celebration')
    await page.getByRole('button', { name: 'Nice!' }).click()
    await celebration.waitFor({ state: 'hidden' })
  } catch {
    // Not a record (or already gone) — nothing to capture.
  }

  const rest = page.locator('.rest-overlay')
  try {
    await rest.waitFor({ state: 'visible', timeout: 2000 })
    await shot(page, 'rest-timer')
    await page.getByRole('button', { name: 'Skip Rest' }).click()
    await rest.waitFor({ state: 'hidden' })
  } catch {
    // No rest timer configured for this exercise — nothing to capture.
  }
}

async function cleanupStamp() {
  const admin = getAdminClient()
  const pattern = `%${stamp}%`

  const { data: exerciseRows } = await admin.from('exercises').select('id').ilike('name', pattern)
  const exerciseIds = (exerciseRows ?? []).map((r) => r.id)

  const { data: templateRows } = await admin.from('workout_templates').select('id').ilike('name', pattern)
  const templateIds = (templateRows ?? []).map((r) => r.id)

  const workoutIds = new Set()
  if (exerciseIds.length) {
    const { data: setRows } = await admin.from('sets').select('workout_id').in('exercise_id', exerciseIds)
    for (const row of setRows ?? []) workoutIds.add(row.workout_id)
  }
  if (templateIds.length) {
    const { data: workoutRows } = await admin.from('workouts').select('id').in('template_id', templateIds)
    for (const row of workoutRows ?? []) workoutIds.add(row.id)
  }

  if (workoutIds.size) await admin.from('workouts').delete().in('id', [...workoutIds])
  if (templateIds.length) await admin.from('workout_templates').delete().in('id', templateIds)
  if (exerciseIds.length) await admin.from('exercises').delete().in('id', exerciseIds)
}

async function main() {
  const browser = await chromium.launch()

  try {
    // Onboarding: a separate, never-signed-in context so signing in for the
    // rest of the run can't taint the "first launch" screenshots.
    const onboardingContext = await browser.newContext({ ...devices['iPhone 13'] })
    const onboardingPage = await onboardingContext.newPage()
    await onboardingPage.goto(BASE_URL)
    await shot(onboardingPage, 'onboarding-welcome')
    await onboardingPage.getByRole('button', { name: /let's hop in/i }).click()
    await shot(onboardingPage, 'onboarding-login')
    await onboardingContext.close()

    // Everything else: signed in as the dedicated test account.
    const context = await browser.newContext({ ...devices['iPhone 13'] })
    const page = await context.newPage()
    const { storageKey, session } = await mintTestSession()
    await page.addInitScript(
      ([key, value]) => localStorage.setItem(key, value),
      [storageKey, JSON.stringify(session)]
    )
    await page.goto(BASE_URL)
    await shot(page, 'home')

    const ex1 = `E2E UX Review Bench ${stamp}`
    const ex2 = `E2E UX Review Row ${stamp}`
    const templateName = `E2E UX Review Push Day ${stamp}`

    // Exercises: create two, with notes + rest timer, so the list and the
    // per-row tag pills have realistic content instead of bare names.
    await page.getByRole('link', { name: 'Exercises', exact: true }).click()
    await page.getByLabel('Name').fill(ex1)
    await page.getByLabel('Setup notes').fill('Bar path close to shins')
    await page.getByLabel('Rest timer (seconds)').fill('90')
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await page.getByLabel('Name').fill(ex2)
    await page.getByRole('button', { name: 'Add exercise' }).click()
    await shot(page, 'exercises-list')

    const ex1Row = page.locator('.row-wrap', { hasText: ex1 })
    await ex1Row.getByRole('button', { name: 'Edit exercise' }).click()
    await shot(page, 'exercise-edit')
    // Still scoped to ex1Row here: the edit form doesn't remove the row's
    // name text, unlike the delete-confirm swap below.
    await ex1Row.getByRole('button', { name: 'Cancel' }).click()

    await ex1Row.getByRole('button', { name: 'Delete exercise' }).click()
    await shot(page, 'exercise-delete-confirm')
    // The confirm step swaps the row's name out of the DOM entirely (see
    // e2e/exercise-delete-confirm.spec.ts), so ex1Row's hasText filter no
    // longer matches anything — query the page directly instead.
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Templates: one template, both exercises attached.
    await page.getByRole('link', { name: 'Templates', exact: true }).click()
    await page.getByRole('button', { name: 'Add template' }).click()
    await page.getByLabel('Name').fill(templateName)
    await page.getByRole('button', { name: 'Add template' }).click()
    await page.getByText(templateName, { exact: true }).click()
    await page.getByRole('combobox').selectOption({ label: ex1 })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('.exercise-row', { hasText: ex1 }).waitFor({ state: 'visible' })
    await page.getByRole('combobox').selectOption({ label: ex2 })
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await page.locator('.exercise-row', { hasText: ex2 }).waitFor({ state: 'visible' })
    await shot(page, 'template-detail')

    // Positional, not hasText: the archive-confirm step swaps the row's name
    // out of the DOM (see e2e/template-archive-confirm.spec.ts), and this is
    // the only template this run creates, so `.last()` stays valid across
    // that swap the same way a hasText filter would not.
    const templateRow = page.locator('.row-wrap').last()
    await templateRow.getByRole('button', { name: 'Archive' }).click()
    await shot(page, 'template-archive-confirm')
    await templateRow.getByRole('button', { name: 'Cancel' }).click()

    // Normal use: log a workout against the template.
    await page.getByRole('link', { name: 'Home', exact: true }).click()
    await shot(page, 'start-workout-picker')
    await page.getByRole('button', { name: templateName, exact: true }).click()
    await page.getByRole('button', { name: 'Start workout' }).click()
    await shot(page, 'logger-exercise-picker')

    // No exercise is pre-selected on entering an active workout — pick the
    // first template exercise's suggested chip before the set-row fields
    // (scoped to whichever exercise is selected) appear.
    await page.getByRole('button', { name: ex1, exact: true }).click()
    await shot(page, 'logger-set-entry-empty')

    await page.getByLabel('Reps').fill('8')
    await page.getByLabel('Weight').fill('135')
    await page.locator('.rpe-toggle').click()
    await page.getByLabel('RPE (optional)').fill('8')
    await page.getByRole('button', { name: 'Add set' }).click()
    await dismissOverlaysIfShown(page)
    await shot(page, 'logger-set-rows-filled')

    const ex2Chip = page.getByRole('button', { name: ex2, exact: true })
    await ex2Chip.click()
    await shot(page, 'logger-exercise-chips')
    await page.getByLabel('Reps').fill('10')
    await page.getByLabel('Weight').fill('40')
    await page.getByRole('button', { name: 'Add set' }).click()
    await dismissOverlaysIfShown(page)

    await page.getByRole('button', { name: 'Finish workout' }).click()
    await shot(page, 'post-finish')

    await page.getByRole('link', { name: 'History', exact: true }).click()
    await shot(page, 'history-list')
    const historyCard = page.locator('.card', { hasText: ex1 }).first()
    await historyCard.locator('li.row-wrap').first().getByRole('button', { name: 'Edit' }).click()
    await shot(page, 'history-set-edit')

    await context.close()
  } finally {
    await browser.close()
    await cleanupStamp()
  }

  console.log(JSON.stringify({ outDir, screenshots: manifest }, null, 2))
}

main().catch((err) => {
  console.error(`capture-ux-screenshots: ${err.message}`)
  process.exit(1)
})
