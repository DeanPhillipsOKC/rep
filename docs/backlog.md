# Backlog

Active work only — canonical list of what's left to build or verify. Read before starting new work.

How this works:

- When an item is finished, delete it from here and add a one-line entry to `docs/backlog-archive.md` (cold storage) with what shipped and a commit ref. Don't leave finished write-ups in this file — that's what bloats context on every load.
- **[human]** tags mark tasks only the user can do (accounts, physical devices, product decisions). Flag if one is unchecked and blocking; don't attempt it yourself.
- "Depends on" call out ordering between items below.
- Every item carries an `[Effort: N, Value: N, ROI: X]` tag — see **Prioritization** below. When adding a new item, assign its scores yourself; the user doesn't want to be involved in that judgment call.
- An item that can't be completed gets an additive `, Status: blocked: <one-line reason>` appended inside its tag instead of being deleted (e.g. `[Effort: 3, Value: 4, ROI: 1.33, Status: blocked: needs a schema change per architecture.md's DDL constraint]`). No `Status` field means open. `Status: needs-review` is also a recognized skip-me marker if a human wants to flag an item without fully blocking it. This convention exists for `.claude/skills/next-item/SKILL.md`, which selects and works the highest-ROI open item unattended (see `docs/backlog-runner.md`).

## Prioritization

Each item is scored on two axes, both on a Fibonacci scale (1, 2, 3, 5, 8, 13):

- **Effort** — implementation complexity/size, your best estimate.
- **Value** — combined technical and business impact (there's no need to separate the two; use one number for "how much this is worth doing").

`ROI = Value / Effort`. Higher ROI = do it sooner. This is a rough forcing function for "what's next," not a precise formula — ties are fine, don't over-think a single point of Effort or Value. Re-score an item if its scope changes materially; otherwise leave existing scores alone even as new items are added around them.

Priority order (highest ROI first) is regenerated from the tags below by `next-item` on every edit
it makes (excluding blocked/needs-review/human items), so it can't drift out of sync. If you edit
scores by hand, recompute this line to match:

1. Item 69 — mismatched button sizing on "Resume your workout?" cards (ROI 2)
2. Item 68 — move accidental-finish resume offer onto the volume chart (ROI 1.5)
3. Item 70 — first-workout celebration card in place of the single-point volume chart (ROI 1.5)
4. Item 71 — allow adding a set to a past workout on the History screen (ROI 1)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

- [ ] Move the "resume accidentally-finished workout" offer off the "Log another workout" path
  (item 68, 2026-09-26 — from discussion, not a UX-review find): today, finishing a templated
  workout shows the volume chart, and tapping "Log another workout" there (`dismissVolumeChart` in
  `WorkoutLogger.vue`) immediately shows a second "Resume your workout?" card because
  `justFinishedWorkout` (item 124/item 1, `docs/backlog-archive.md`) is still set — re-litigating a
  decision the user just made twice (finish, then explicitly "log another"). The undo-for-accidental-
  finish value is real, it's just surfaced at the wrong moment. Move it onto the volume chart screen
  itself instead — a secondary "Finished too early? Resume" affordance next to "Log another
  workout" — so tapping "Log another workout" goes straight to the start screen with no second gate.
  Freeform workouts (no volume chart) already show the offer immediately on finish; leave that path
  alone. [Effort: 2, Value: 3, ROI: 1.5]

- [ ] Mismatched button sizing on the "Resume your workout?" cards (item 69, 2026-09-26): both the
  crash-recovery card (`WorkoutLogger.vue:879-882`) and the just-finished card (`:907-910`) pair a
  `btn-accent` primary button (`width: 100%` per `style.css`) with a plain `ghost` secondary button
  (no width, sizes to its own text) inside a `.confirm-actions` flex row — the accent button eats
  most of the row's width and squeezes "Discard workout"/"Start a new workout" down to a cramped,
  wrapped label. Every other confirm/cancel pair in this file (delete-set at `:1238-1241`,
  empty-finish at `:1301-1304`) already avoids this by giving both buttons matching `... small`
  classes. Not asking for the same color, just the same size — apply the same `small`-class (or
  equivalent equal-width) pattern to these two cards' button pairs. [Effort: 1, Value: 2, ROI: 2]

- [ ] Replace the volume chart with a first-workout celebration card when there's only one point
  (item 70, 2026-09-26): `handleFinish` (`WorkoutLogger.vue:826-830`) sets `showingVolumeChart =
  true` whenever a templated workout finishes with at least one set, regardless of how many points
  `workout.volumeHistory` ends up with — the first time a given template is ever completed, that's
  a single dot with nothing to show "over time," which reads as a rendering glitch rather than a
  chart. When `workout.volumeHistory.length <= 1` after `fetchTemplateVolumeHistory` resolves, show
  a congratulatory card in the same slot instead of `VolumeChart`: reuse the existing mascot pool
  (`src/lib/celebration.ts`'s `pickCelebration()`, the same bunny/bear art `RecordCelebration.vue`
  already uses) with a headline congratulating them on finishing their first workout, plus a smaller
  line of the form "Track your volume over time as you complete more workouts." Still dismissed by
  the same "Log another workout" button/`dismissVolumeChart` handler as today, so it doesn't change
  the resume-offer sequencing item 68 addresses. [Effort: 2, Value: 3, ROI: 1.5]

- [ ] Let a set be added to a past workout on the History screen, not just edited/deleted (item 71,
  2026-09-26): `WorkoutHistory.vue`'s per-set actions (`:252-264`) only offer Edit/Delete on an
  already-existing set — adding a brand-new one to a finished workout was explicitly called out as
  out of scope when that edit/delete flow shipped (see the file's own comment at `:15-19`, item 32).
  The store has no path for it either: `addSet` (`stores/workouts.ts:360+`) writes against
  `activeWorkoutId`, the live in-progress session, not an arbitrary past `workout_id`. Needs a new
  store function (same insert shape as `addSet`, targeting a passed-in `workoutId` instead of
  `activeWorkoutId`, no rest-timer/record-celebration side effects since the workout is already
  finished) plus an "Add set" affordance per expanded history card with an exercise picker (the
  existing flat set list has no exercise-scoped entry point today) and the same reps/weight/unit/RPE
  fields the edit form already uses. [Effort: 3, Value: 3, ROI: 1]

## Testing / tooling

(none open)

## Human setup / device verification

- [ ] **[human]** After interrupted-workout recovery and safe set retry ship, exercise the
  installed app during a real workout on Android and iPhone: reload/relaunch mid-session, briefly
  lose connectivity during a set save, and confirm the visible and saved set counts agree after
  reconnecting. Record any confusing states or duplicate/lost sets for a follow-up backlog item.

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
- [ ] **[human]** Drop the now-unused `category` column from the live `exercises` table (item 30, shipped 2026-09-24, `docs/backlog-archive.md`): run `alter table exercises drop column category;` in the Supabase SQL editor. Code no longer reads or writes it either way, so this is cleanup, not a blocker.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
