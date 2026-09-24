# Backlog archive (cold storage)

Completed backlog items and finished setup tasks, condensed to one-liners. Not part of the
"read before making changes" set in `CLAUDE.md`/`AGENTS.md` — open this only if you need history
on something already shipped. New entries get appended here when an item is removed from
`docs/backlog.md`.

## Setup / accounts

- GitHub repo created: https://github.com/DeanPhillipsOKC/rep
- Supabase project created (`zdcoqykpuhyftuqtyngt`); URL + anon key in `.env.local` (gitignored).
- Cloudflare Pages connected to the repo; build command `npm run build`, output `dist`; env vars
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set and confirmed baked into the deployed bundle.
- Node LTS installed locally; `npm install` / `npm run build` verified.

## Supabase configuration

- `supabase/schema.sql` + `supabase/policies.sql` applied; verified via anon-key REST calls
  (empty reads, `42501` on unauthenticated writes).
- Passkey support confirmed public-beta as of 2026-05; decision made to build passkey-first
  anyway (see `docs/architecture.md#authentication`).
- Relying Party configured: Display Name `Workout Tracker`, RP ID `rep-970.pages.dev`, RP Origins
  `https://rep-970.pages.dev`; confirmed via `/auth/v1/settings`.
- URL Configuration: Site URL `https://rep-970.pages.dev`; redirect URLs include that plus
  `http://localhost:5173`.
- Open sign-ups disabled; confirmed via `/auth/v1/settings` (`disable_signup: true`).
- Both allowed accounts pre-created manually (Auto Confirm), no `allowed_users` table.

## Decisions made

- Allowed users: dephillips1977@gmail.com (owner, Android), christashouse@hotmail.com (invited, iPhone).
- Platform priority: Android first, iPhone verified opportunistically.

## Device verification

- Android, browser tab: magic-link sign-in and passkey registration both worked on
  `rep-970.pages.dev` in Chrome.

## Shipped features

- Core workout logging: create workout, add sets, view history (`8da13e5`).
- `profiles` row auto-created on sign-in to satisfy `exercises`/`workouts` FK (`850742a`).
- Dark, mobile-first styling for auth and logging screens (`714909b`).
- Placeholder PWA icons added (`06a0cd4`).
- Local/automated auth path for testing: `scripts/create-test-session.mjs` (`npm run test:session`) mints a real session for a designated test account via the Supabase Admin API (service-role `generateLink` + anon-key `verifyOtp`), unblocking browser/E2E automation without a client-visible auth bypass. See `docs/architecture.md#testing--automation`.
- Playwright e2e harness added (`e2e/`, `npm run test:e2e`); `e2e/fixtures/auth.ts` reuses the test-session mint to start specs already signed in. Confirmed passing locally against Chromium, including the signed-in-via-injected-session case.
- Workout templates (hierarchy): `workout_templates` + `workout_template_exercises` tables, `workouts.template_id`, matching RLS, a Templates tab to build/reorder named routines, template selection + suggested-exercise chips when starting a workout, and a template tag in History. Verified via `e2e/templates.spec.ts`. Unblocks backlog items 3 and 6.
- Pre-fill from last workout of the same template: starting a workout against a template fetches the most recent past workout for it and shows a "Last time" card (notes + per-exercise reps/weight in set order); selecting an exercise pre-fills reps/weight/unit from its last set. Verified via `e2e/pre-fill.spec.ts`. Unblocks the lookup half of backlog item 6.
- Don't persist a workout with zero sets logged (item 9): `finishWorkout()` in `src/stores/workouts.ts` now deletes the `workouts` row if `activeSets` is still empty when the user finishes/abandons a workout, instead of leaving an empty row behind. Verified via a new `e2e/zero-set-cleanup.spec.ts`, which confirms the row is actually gone via the admin client, not just hidden from the UI. Also cleaned up 23 pre-existing empty rows already in the real database (both accounts) with a one-off admin-client script, run by the user directly after the auto-mode classifier blocked Claude from reading/writing production data itself.
- Fix parallel-set pre-fill for previous-workout sets (item 9): `WorkoutLogger.vue` pre-fill now indexes into the previous workout's per-exercise sets by set position (count of sets already logged this session for that exercise), not always the last set logged — fatigue means set 1 should compare to set 1, not whichever set happened to be logged last. Falls back to no pre-fill when this session has already logged more sets for that exercise than last time. Also now re-runs on every `addSet` (watching `activeSets.length`, not just `watch(exerciseId, ...)`), so re-picking the same exercise for set 2 refreshes reps/weight without needing a different exercise selected in between. Verified via a new case in `e2e/pre-fill.spec.ts` covering superset-style alternation.
- PR toast on new record (item 4): `addSet` in `src/stores/workouts.ts` now kicks off a background, session-cached per-exercise best-volume check after each insert (never blocking the add itself), and `WorkoutLogger.vue` shows an auto-dismissing "New record: <exercise>" toast when `reps * weight` beats the all-time best for that exercise across all past workouts. Verified via a new `e2e/pr-toast.spec.ts`. While verifying, found and documented (not fixed — out of scope) a pre-existing `set_index` race in `addSet`; see backlog item 10.
- Exercise setup notes (item 8): `exercises` gains a nullable `setup_notes text` column (migration applied by the user directly in the Supabase SQL editor — no DDL execution path available to Claude in this repo). `src/stores/exercises.ts` gained `updateSetupNotes`; `ExerciseList.vue` shows an "Add notes"/"Edit notes" affordance per row with an inline textarea; `WorkoutLogger.vue` surfaces the selected exercise's notes right above the reps/weight fields. Verified via a new `e2e/exercise-notes.spec.ts` (add, edit, and see during logging).
- Visible build version (item 10): dropped GitVersion (its `dotnet-gitversion` tool needs a .NET SDK, which Cloudflare Pages' build image doesn't have, and no maintained npm wrapper reproduces its output) in favor of a git-native Node script. `scripts/lib/build-version.mjs` unshallows the clone if needed (Cloudflare Pages checks out shallow), then combines `git rev-list --count HEAD` and the short SHA into e.g. `v142+a1b2c3d`; injected via Vite `define` in `vite.config.ts`, set on `document.title`, and also shown in a small on-page footer (`src/App.vue`) since the PWA runs standalone/installed with no tab strip to show a title in. Dirty-tree detection diffs tracked-file content only (`core.fileMode=false`) so a CI checkout's executable-bit noise doesn't falsely flag `-dirty`. Verified live against the deployed site and via `e2e/auth.spec.ts` (`6b675fe`, `a4a873b`, `4146316`).
- On-demand data-wipe script (item 5): `scripts/wipe-account-data.mjs` (`npm run wipe:account -- <email-or-user-id>`) resolves the target account via the Admin API (accepts either a UUID or an email, paginating `listUsers` to match on email since `profiles` has no email column), then deletes `workouts` (cascades `sets`), `workout_templates` (cascades `workout_template_exercises`), and `exercises` for that `user_id` — in that order, since `workouts.template_id`/`sets.exercise_id`/`workout_template_exercises.exercise_id` have no cascading delete. Leaves the auth user and `profiles` row intact. Refuses to run with no argument, so it can never touch more than one account at a time. Not covered by Playwright (no UI surface); verified directly against the real test account: seeded an exercise/workout/set, ran the wipe by email, confirmed all three tables cleared, then ran it again by user id against the now-empty account to confirm the id-resolution path and idempotency.
