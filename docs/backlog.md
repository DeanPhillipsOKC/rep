# Backlog

Active work only — canonical list of what's left to build or verify. Read before starting new work.

How this works:

- When an item is finished, delete it from here and add a one-line entry to `docs/backlog-archive.md` (cold storage) with what shipped and a commit ref. Don't leave finished write-ups in this file — that's what bloats context on every load.
- **[human]** tags mark tasks only the user can do (accounts, physical devices, product decisions). Flag if one is unchecked and blocking; don't attempt it yourself.
- "Depends on" call out ordering between items below.

## Features

### 2. Workout templates (hierarchy)

Add a "workout template" concept above the existing `workouts`/`sets` tables: a named, reusable routine (e.g. "Push Day") with an ordered list of exercises. A logged `workouts` row becomes an instance of a template rather than a bag of unrelated sets.

- **Decision:** named templates, not freeform label-matching.
- Schema: new `workout_templates` (id, user_id, name, is_archived) + `workout_template_exercises` (template_id, exercise_id, position, target_sets nullable) join table; `workouts` gains `template_id uuid references workout_templates(id)`.
- RLS: same per-user ownership pattern as `exercises`/`workouts`.
- **Depends on:** none — foundational. Items 3 and 6 depend on this.

### 3. Pre-fill from last workout of the same template

When starting a new workout against a template, load the most recent previous `workouts` row for that `template_id` and show its notes, weights, reps, and set order per exercise, so the user can see what to beat.

- **Depends on:** item 2 (needs `template_id` to define "same type").

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
- **Depends on:** item 2 (templates define what "complete" means) and the lookup mechanism from item 3.

## Human setup / device verification

- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** Android, installed PWA: retry install now that manifest icons are fixed (they previously 404'd, silently failing Chrome's installability check). If the `⋮` menu still doesn't offer a real "Install app" option, get a screenshot for diagnosis.
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** App display name, theme color, and final icon (or approve the current placeholder set).
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
