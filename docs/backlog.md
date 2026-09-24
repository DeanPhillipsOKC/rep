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
| 6 | Post-workout volume chart | 8 | 8 | 1.0 |
| 10 | Fix set_index race in addSet | 3 | 3 | 1.0 |

## Features

### 6. Post-workout volume chart `[Effort: 8, Value: 8, ROI: 1.0]`

At the end of a workout, show total volume (Σ reps × weight across all sets) for that template over time, as a two-line chart:

- **Actual line:** literal volume per past workout instance of that template.
- **Projected line:** for any workout instance where one or more template exercises were skipped or under-completed, backfill the missing exercise(s)' numbers from that exercise's own most recent prior appearance (straight carry-forward) before summing volume for that point.
- **Decision (explicit — don't recompute):** no weighted-percentage formula. Missing/incomplete pieces are filled with the last-known values for that exercise, on the assumption the user wouldn't have done worse than before.
- **Depends on:** templates (shipped — `docs/backlog-archive.md`; define what "complete" means) and the last-workout lookup (shipped — `docs/backlog-archive.md`; `fetchPreviousWorkout` in `src/stores/workouts.ts`).

### 10. Fix set_index race in addSet `[Effort: 3, Value: 3, ROI: 1.0]`

**Discovered while shipping item 4** (see `docs/backlog-archive.md`), not caused by it — reproduces on plain `main` too. `addSet` in `src/stores/workouts.ts` derives `set_index` from `activeSets.value.length`, read synchronously per call. Two `addSet` calls fired close together (e.g. logging a superset — different exercises back to back without waiting for the first insert to resolve) can both read the same length before either has inserted, so both rows land with the same `set_index`. This corrupts the position-based pre-fill (item 9, `docs/backlog-archive.md`) for that workout — confirmed via `e2e/pre-fill.spec.ts`'s "set position tracks across exercises logged in parallel" spec, which fails intermittently (~1 in 4-8 runs) on unmodified `main`.

- A client-side queue was tried and made it worse (a queued call whose turn came up after the workout was finished silently dropped the set instead of colliding) — the correct fix likely needs `set_index` assigned server-side (e.g. a Postgres default/trigger computing `count(*) + 1` scoped to `workout_id`, inside the same transaction as the insert), not a client-side workaround.
- Low urgency for real usage (two users, not usually mashing "Add set" across exercises within tens of milliseconds of each other) but worth fixing since it's a real data-integrity bug, not just a test flake.

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
