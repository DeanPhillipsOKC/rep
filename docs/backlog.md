# Backlog

Active work only — canonical list of what's left to build or verify. Read before starting new work.

How this works:

- When an item is finished, delete it from here and add a one-line entry to `docs/backlog-archive.md` (cold storage) with what shipped and a commit ref. Don't leave finished write-ups in this file — that's what bloats context on every load.
- **[human]** tags mark tasks only the user can do (accounts, physical devices, product decisions). Flag if one is unchecked and blocking; don't attempt it yourself.
- "Depends on" call out ordering between items below.

## Bugs

### 9. Don't persist a workout with zero sets logged

Starting a workout and finishing it (or abandoning it) without adding any sets still leaves a `workouts` row behind with no `sets` rows under it. This isn't just clutter — it already broke the "last time" pre-fill (item 3): the lookup found the most recent `workouts` row for a template before checking whether it had sets, so an empty workout could shadow a real one until fixed with `sets!inner` in `fetchPreviousWorkout` (`src/stores/workouts.ts`). Any future reporting that scans `workouts` directly (item 6's volume chart, exercise history) has the same trap unless it also remembers to filter for sets.

- **Fix:** don't let an empty workout survive. Either (a) delete the `workouts` row on `finishWorkout()` if `activeSets` is still empty, or (b) defer creating the `workouts` row at all until the first `addSet` call succeeds (`startWorkout` would stage the notes/template locally and insert on first set). Pick whichever fits the current `startWorkout`/`addSet`/`finishWorkout` flow in `src/stores/workouts.ts` with the least rework.
- **Scope:** only the app-created path going forward. Existing empty rows already in the data don't need an automatic cleanup migration — item 5's wipe script (or a manual delete) covers stale test data if it matters.

## Features

### 4. PR toast on new record

When a set is added, compare `reps * weight` against the user's best-ever value for that `exercise_id` across all past workouts. If it's a new max, show a congratulatory toast.

- Scope: per-user, per-exercise all-time max — not scoped to the current workout or template.

### 5. On-demand data-wipe script

A script (not wired into the UI) that clears all workout data for a given account, so repeated manual/exploratory test scenarios don't accumulate stale data.

- Must take an explicit user id/email argument and refuse to run without one — never a blanket wipe that could hit both real accounts.
- Service-role key, local-only — same handling constraints as item 1.

### 6. Post-workout volume chart

At the end of a workout, show total volume (Σ reps × weight across all sets) for that template over time, as a two-line chart:

- **Actual line:** literal volume per past workout instance of that template.
- **Projected line:** for any workout instance where one or more template exercises were skipped or under-completed, backfill the missing exercise(s)' numbers from that exercise's own most recent prior appearance (straight carry-forward) before summing volume for that point.
- **Decision (explicit — don't recompute):** no weighted-percentage formula. Missing/incomplete pieces are filled with the last-known values for that exercise, on the assumption the user wouldn't have done worse than before.
- **Depends on:** templates (shipped — `docs/backlog-archive.md`; define what "complete" means) and the last-workout lookup (shipped — `docs/backlog-archive.md`; `fetchPreviousWorkout` in `src/stores/workouts.ts`).

### 7. Edit exercise name

Exercises currently support create and archive only (`src/stores/exercises.ts`) — no way to fix a typo'd or rename an existing exercise's `name` without archiving it and losing its history linkage. Add an edit affordance (inline or a small form) that updates `name` on the existing row, same RLS as today.

### 8. Exercise setup notes

**User request:** add freeform notes to an exercise (e.g. machine seat height, incline position) and see them while logging a set for that exercise, so setup is consistent workout to workout.

- Schema: `exercises` gains a nullable `setup_notes text` column (or similarly named — distinct from a per-workout `workouts.notes`, which is about that day's session, not the machine).
- Editable wherever exercise name/category are managed (see item 7 for the edit affordance this can share).
- Surface in `WorkoutLogger.vue`: show the selected exercise's notes near the set-entry form, not just in the Exercises tab, since that's the moment it's needed.

## Human setup / device verification

- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** Android, installed PWA: retry install now that manifest icons are fixed (they previously 404'd, silently failing Chrome's installability check). If the `⋮` menu still doesn't offer a real "Install app" option, get a screenshot for diagnosis.
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** App display name, theme color, and final icon (or approve the current placeholder set).
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Future discussion:* what is the `exercises.category` field actually for? It's currently just a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing in the app filters, groups, or otherwise behaves differently based on it. Needs a decision: define a real purpose for it (e.g. filtering the exercise picker, grouping template exercises) or drop the field if it's not earning its keep.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
