# Backlog

Active work only — canonical list of what's left to build or verify. Read before starting new work.

How this works:

- When an item is finished, delete it from here and add a one-line entry to `docs/backlog-archive.md` (cold storage) with what shipped and a commit ref. Don't leave finished write-ups in this file — that's what bloats context on every load.
- **[human]** tags mark tasks only the user can do (accounts, physical devices, product decisions). Flag if one is unchecked and blocking; don't attempt it yourself.
- "Depends on" call out ordering between items below.
- Every item carries an `[Effort: N, Value: N, ROI: X]` tag — see **Prioritization** below. When adding a new item, assign its scores yourself; the user doesn't want to be involved in that judgment call.

## Prioritization

Each item is scored on two axes, both on a Fibonacci scale (1, 2, 3, 5, 8, 13):

- **Effort** — implementation complexity/size, your best estimate.
- **Value** — combined technical and business impact (there's no need to separate the two; use one number for "how much this is worth doing").

`ROI = Value / Effort`. Higher ROI = do it sooner. This is a rough forcing function for "what's next," not a precise formula — ties are fine, don't over-think a single point of Effort or Value. Re-score an item if its scope changes materially; otherwise leave existing scores alone even as new items are added around them.

Priority order (highest ROI first), kept in sync with the tags below:

| # | Item | Effort | Value | ROI |
|---|------|--------|-------|-----|
| 31 | Ability to delete a workout from History | 2 | 3 | 1.5 |
| 33 | Welcome-card/coachmark flashes on Log-screen refresh for users who already have exercises | 2 | 3 | 1.5 |
| 25 | Archiving an exercise doesn't remove it from templates it's already attached to | 3 | 3 | 1 |
| 29 | Rotating words-of-encouragement copy on the rest timer screen | 2 | 2 | 1 |
| 30 | Remove the unused `exercises.category` field | 2 | 2 | 1 |
| 32 | Ability to edit a past workout from History | 5 | 3 | 0.6 |
| 24 | Redesign exercise row actions into pencil/trash icons instead of four text buttons | 5 | 3 | 0.6 |

## Features

### 31. Ability to delete a workout from History `[Effort: 2, Value: 3, ROI: 1.5]`

Requested 2026-09-24. `WorkoutHistory.vue` is read-only today — no way to remove a workout logged in error (duplicate, wrong day, test data) once it's finished. Distinct from item 13 (already shipped), which covers editing/deleting an individual *set* while a workout is still in progress; this is deleting the whole workout row after the fact, from History. `sets.workout_id` already has `on delete cascade` (`supabase/schema.sql`), so deleting the `workouts` row alone is enough — no separate cleanup of its sets needed. Fix direction: a delete affordance per History card, behind a confirm step (destructive, no undo) — `useWorkoutsStore` needs a new `deleteWorkout(id)` removing the row and updating `history` locally, same pattern as `archiveExercise`. Worth deciding alongside item 32 whether both live behind one shared "edit workout" entry point or delete stays its own simpler action.

### 33. Welcome-card/coachmark flashes on Log-screen refresh for users who already have exercises `[Effort: 2, Value: 3, ROI: 1.5]`

Reported 2026-09-24. `WorkoutLogger.vue`'s zero-exercise welcome card and menu coachmark (item 27) are gated on `exercises.activeExercises.length === 0` (lines ~352/101), but `exercises.exercises` starts empty in the Pinia store on every fresh page load — `onMounted` (line 55) only *starts* `fetchExercises()`, it doesn't await it before the template renders. Result: for a user who already has exercises, reloading the Log screen briefly shows the "Welcome to REP" card and the "More lives in the menu" coachmark arrow before the fetch resolves and they disappear — a visible flash that reads as a bug, not onboarding, to someone who's past onboarding. Fix direction: track fetch status (e.g. a `loaded`/`loading` ref in `useExercisesStore` or a local one in `WorkoutLogger.vue`, set on mount before calling `fetchExercises` and cleared once it resolves) and don't render the welcome card/coachmark — or anything else keyed off "zero exercises" — until that first fetch has actually completed. A brief neutral/blank state (or nothing at all) while loading beats confidently showing the wrong thing.

### 32. Ability to edit a past workout from History `[Effort: 5, Value: 3, ROI: 0.6]`

Requested 2026-09-24, split out from item 31 as a separate item since editing is materially more work than deleting. Once a workout is finished, `WorkoutHistory.vue` offers no way to fix a wrong rep/weight/RPE entry, add or remove a set, or edit the workout's notes — the only escape today is deleting the whole workout (item 31) and re-logging it. Fix direction: reuse as much of the active-workout edit/delete-a-set UI from item 13 as reasonably fits a finished workout's card, plus notes editing. Needs a decision on scope: allow adding a brand-new set to a past workout (re-triggers `set_index`/volume-chart implications for any template it's linked to), or restrict editing to sets that already exist. Depends on item 31 landing first isn't required, but sharing a UI entry point ("Edit" on the History card) is worth designing once instead of twice.

### 30. Remove the unused `exercises.category` field `[Effort: 2, Value: 2, ROI: 1]`

Decided 2026-09-24 (user call, replacing the prior "what is category actually for" open question): drop it rather than invent a use. It's a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing filters, groups, or otherwise behaves differently based on it. Remove the input from `ExerciseList.vue`'s create form and the `<div v-if="exercise.category">` display, drop the param from `createExercise` (`src/stores/exercises.ts`), and drop the column via a migration the user applies directly in the Supabase SQL editor (same no-DDL-access pattern as every other schema change here) — `alter table exercises drop column category;`. If a real use for it turns up later, re-add it fresh rather than trying to resurrect this one. Touches `docs/architecture.md`'s data-model table. Note for item 24 (pencil/trash icon redesign, not yet built): its write-up currently lists "category" as one of the fields the consolidated edit flyout should cover — drop that if this item ships first.

### 25. Archiving an exercise doesn't remove it from templates it's already attached to `[Effort: 3, Value: 3, ROI: 1]`

Found 2026-09-25 while reviewing the archive flow. `archiveExercise` (`src/stores/exercises.ts`) only flips `exercises.is_archived`; it never touches `workout_template_exercises`, and nothing reading template exercises (`templates.exercisesByTemplate`, consumed by `TemplateManager.vue`'s exercise list and `WorkoutLogger.vue`'s suggested chips/`availableExercises` for a templated workout) filters on the joined exercise's `is_archived`. Net effect: archiving correctly hides an exercise from the create-exercise flow, the freeform workout picker, and new template-exercise-add dropdowns — but if it's already attached to a template, it keeps appearing as a suggested chip and a loggable option every time that template is used, with no indication anywhere that it's archived. Fix direction: filter the template-exercise read path (or its consumers) by `exercise.is_archived`, so an archived exercise stops surfacing for future workouts against templates it's still attached to (past logged sets are unaffected either way — they read the set's own `exercise_id`, not this list). Separately worth deciding: should archiving warn first when the exercise is attached to at least one active template ("used in Leg Day — archiving removes it from future workouts there")? Leaning yes, but that's better folded into whatever confirm-step UI item 24 builds for delete than shipped as a standalone alert here.

### 29. Rotating words-of-encouragement copy on the rest timer screen `[Effort: 2, Value: 2, ROI: 1]`

Spitballed 2026-09-24 alongside item 28, deliberately split out so the core rest-screen build (item 28) doesn't grow scope creep from a copy-rotation system. Instead of one fixed line ("Nice work — take a breather"), cycle through a small hand-written set of encouraging phrases ("Take a load off. You've earned it.", "Keep it up.", etc.) — picked randomly or rotated per rest, on the same headline slot item 28's screen already has. Depends on item 28 shipping first (same screen, same headline element).

### 24. Redesign exercise row actions into pencil/trash icons instead of four text buttons `[Effort: 5, Value: 3, ROI: 0.6]`

Reported 2026-09-25. Each row in `ExerciseList.vue` currently exposes four separate ghost buttons ("Edit name", "Edit notes"/"Add notes", "Edit rest timer"/"Add rest timer", "Archive"), each opening its own inline form — wordy today, and it only grows with item 22. User's preferred direction (over an ellipsis-triggered dropdown, which was also considered): two icon affordances on the right of the row — a pencil that opens one consolidated edit flyout covering name, category, setup notes, and rest timer together, and a trash-can (or X) that requires an explicit confirm step before removing the exercise.

Depends on the archive-vs-delete decision below (**[human]**) — what the trash icon actually does and what its confirmation copy says both hinge on that call; don't build this until it's settled. Touches `e2e/exercise-edit-name.spec.ts`, `e2e/exercise-notes.spec.ts`, `e2e/rest-timer.spec.ts`, and any other spec locating today's text-labeled buttons — icon buttons will need `aria-label`s for those to target instead.

## Human setup / device verification

- [ ] **[human]** Interactive "fresh account" test login (2026-09-24, from backlog item 26's discussion): create a second Supabase auth user for `dephillips1977+test@gmail.com` (Authentication → Users → Add user, Auto Confirm — Gmail's plus-addressing delivers to the same inbox, no new account needed on the phone; Supabase treats it as a fully separate auth identity). Sign into it once via magic link in an incognito window or a separate Chrome profile, then register a passkey there — after that it's one-tap sign-in, isolated from both real accounts by RLS, with nothing to purge to reset to a "brand-new user" view. This is distinct from `TEST_ACCOUNT_EMAIL` (`docs/architecture.md#testing--automation`), which is scripted/Playwright-only — this one's for poking at the real UI by hand.
- [ ] **[human]** Backlog item 15 (per-exercise rest timer with push notification): confirmed working end-to-end on Android, unlocked, including sound (2026-09-24 — the one apparent "no sound" case was the phone's Bluetooth being connected to a car, not a code issue). Still open:
  - [x] Locked-phone/backgrounded-app delivery: confirmed working 2026-09-24 after the visibilitychange fix (item 28 follow-up, `docs/backlog-archive.md`) — push with vibration now arrives after backgrounding mid-rest. (First pass had found it silently broken: no push, no vibration at all, root-caused to the push only being decided at `addSet` time instead of on the app actually going to background.)
  - [ ] iPhone verification: same flow, on the iPhone user's device.
  - [ ] Revoke the temporary Supabase personal access token used for the CLI deploy (dashboard → Access Tokens) now that it's no longer needed.
- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** *(optional, cosmetic)* WebAuthn Relying Party Display Name in the Supabase dashboard (Authentication → Passkeys) still reads "Workout Tracker" from before the REP rebrand — some browsers surface this string in the passkey UI. Update it there if you want it to match; it's a dashboard setting, not something in the repo.
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Blocks item 24:* "Archive" on an exercise (`ExerciseList.vue`'s "Archive" button, `exercises.is_archived`) has no restore path anywhere in the UI — no archived-exercises view, no "unarchive" action. From the user's perspective it already behaves exactly like a permanent delete; the "archive" label just implies a recoverability that doesn't exist. Needs a decision between: (a) build real restore (an archived-exercises list + unarchive action), or (b) keep today's soft-delete mechanism as-is at the DB level — it's what lets an exercise be removed without breaking the FK reference from existing `sets`/`workout_template_exercises` rows, since neither has an `ON DELETE` clause and a real hard delete would fail outright while any history references it — but relabel/reframe the UI as "Delete" with a confirmation step, dropping the "archive" pretense. (b) is the cheaper option and matches what the user described wanting ("if there's not a way to restore, we should just treat it as delete").

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
