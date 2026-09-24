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
| 19 | Progress strip on the Log home screen (workouts this week / recent PR) | 3 | 5 | 1.7 |

## Features

### 19. Progress strip on the Log home screen (workouts this week / recent PR) `[Effort: 3, Value: 5, ROI: 1.7]`

Item 18 (nav redesign) shipped, so this is now unblocked. Mockup shows two stats: a workout count for the current week and a "new record" callout, to make the tagline's "stronger every set" idea visible rather than just stated.

- "N workouts this week": count `workouts` rows (`performed_at`, `supabase/schema.sql`) for the signed-in user within the current calendar week. Straightforward count query, no new schema.
- "Recent PR" is the harder half — there's no persisted record of *when* a PR happened, only the ephemeral in-memory check in `src/stores/workouts.ts` (`newRecord`, backlog-archive.md item 4) that drives the toast and is gone once the session ends. Options to resolve during implementation, pick one:
  - Recompute on load: re-run the existing best-volume-per-exercise check against the most recent workout's sets only, on mount. Cheap, no migration, but only ever shows "since your last workout," never further back.
  - Persist it: add a `sets.is_pr boolean` (or similar) set at insert time by the same check `addSet` already runs, so the strip can query "most recent set where is_pr" directly. Needs a migration (no DDL access from here — same constraint as items 8/10/15, user applies it in the Supabase SQL editor) but gives an accurate "New record Tue" instead of just "new record since last time."
- If neither is worth the complexity for a small home-screen stat, cutting this stat and keeping only the "workouts this week" count is a reasonable scope-down — flag it back to the user rather than guessing.

## Human setup / device verification

- [ ] **[human]** Backlog item 15 (per-exercise rest timer with push notification): confirmed working end-to-end on Android, unlocked, including sound (2026-09-24 — the one apparent "no sound" case was the phone's Bluetooth being connected to a car, not a code issue). Still open:
  - [ ] Locked-phone delivery: lock the screen before the rest timer elapses and confirm the notification still arrives.
  - [ ] iPhone verification: same flow, on the iPhone user's device.
  - [ ] Revoke the temporary Supabase personal access token used for the CLI deploy (dashboard → Access Tokens) now that it's no longer needed.
- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** Android, installed PWA: retry install now that manifest icons are fixed (they previously 404'd, silently failing Chrome's installability check). If the `⋮` menu still doesn't offer a real "Install app" option, get a screenshot for diagnosis.
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** *(optional, cosmetic)* WebAuthn Relying Party Display Name in the Supabase dashboard (Authentication → Passkeys) still reads "Workout Tracker" from before the REP rebrand — some browsers surface this string in the passkey UI. Update it there if you want it to match; it's a dashboard setting, not something in the repo.
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Future discussion:* what is the `exercises.category` field actually for? It's currently just a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing in the app filters, groups, or otherwise behaves differently based on it. Needs a decision: define a real purpose for it (e.g. filtering the exercise picker, grouping template exercises) or drop the field if it's not earning its keep.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
