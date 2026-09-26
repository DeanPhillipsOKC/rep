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

1. Carry over RPE from the previous set when pre-filling a new set (ROI 3.00)
2. Fix RPE quick-entry requiring two taps with a flickering label (ROI 2.00)
3. Let an accidentally-finished workout be resumed instead of only starting a new one (ROI 1.67)
4. Redesign the set-row entry UI for size, alignment, and low-vision accessibility (ROI 1.67)
5. Remove JSON training data export (ROI 1.50)
6. Show exercise-by-exercise history (ROI 1.00)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

- [ ] Fix RPE quick-entry requiring two taps with a flickering label — in the active workout
  logger's set row (`WorkoutLogger.vue`), RPE starts as a `+RPE` toggle button; tapping it swaps in
  a separate input (placeholder `RPE`) that isn't focused yet, so a second tap is needed to actually
  open the keyboard and type a value. The label visibly changes from `+RPE` to `RPE` on that first
  tap, which reads as a flicker/inconsistency rather than an intentional state change. Auto-focus
  the revealed input when the toggle is clicked so one tap both reveals and opens it for entry, and
  make the toggle-to-placeholder transition read as one continuous control rather than two different
  labels. Cover the one-tap-to-focus behavior in Playwright.
  [Effort: 1, Value: 2, ROI: 2.00]

- [ ] Carry over RPE from the previous set when pre-filling a new set — the active workout
  logger's `applyPrefillToRow` (`WorkoutLogger.vue`) already seeds a new draft row's reps and
  weight from the position-matching set logged last time, but leaves `rpe` at `null` and
  `rpeOpen` at `false`, so a value entered for set N previously has no effect on the same set
  position this session even though reps/weight do carry over. Seed `row.rpe` from the matching
  previous set the same way reps/weight already are, and open the RPE field (`rpeOpen = true`)
  when the seeded value is non-null so it's visible without an extra tap. Leave it untouched
  (closed, `null`) when the previous set had no RPE recorded. Cover both cases — carried-over
  value shown open, and no-prior-RPE staying closed — in Playwright.
  [Effort: 1, Value: 3, ROI: 3.00]

- [ ] Let an accidentally-finished workout be resumed instead of only starting a new one —
  reported from real use: tapping "Finish workout" (`WorkoutLogger.vue`'s `handleFinishClick`)
  when meaning to switch to the next exercise (e.g. via the template exercise chips) is an easy
  mistake, and today there's no way back — `finishWorkout()` (`stores/workouts.ts`) only confirms
  before finishing when zero sets were logged (backlog-archive item 51); once any set exists it
  finishes immediately with no undo. The finished workout's row and sets aren't actually deleted
  server-side in that case (`finishWorkout` only deletes on the zero-sets path), so the data needed
  to resume already exists — the gap is purely that the client clears `activeWorkoutId` and never
  offers to re-attach to it. Add a short-lived "Resume workout" option, offered right after finishing
  alongside "start a new workout," that re-attaches `activeWorkoutId` to the just-finished workout
  and restores `activeTemplateId`/`activeSets` from the server — reusing the same restore shape as
  the existing crash-recovery `resumeRecoverableWorkout` flow and its "Resume your workout?" card
  (`WorkoutLogger.vue`), rather than only appearing inside the template-gated post-finish volume
  chart (`showingVolumeChart`, which never shows for a freeform/no-template workout). Scope the
  window so it only offers the single most-recently-finished workout and clears once a new workout
  is started, so it can't be confused with editing older sessions from History (item 32,
  `docs/backlog-archive.md`). Cover resume-after-finish (template and freeform) and the window
  clearing on next-workout-start in Playwright.
  [Effort: 3, Value: 5, ROI: 1.67]

- [ ] Remove JSON training data export — remove the "Your data" card and download action from
  Exercises, the export helper, and its export-specific Playwright spec. There is no in-app import
  path or current user need for a raw JSON backup; a file that cannot be restored or readily read
  adds UI and maintenance cost without a clear pilot benefit. Update `docs/architecture.md` and
  `docs/product-roadmap.md` to remove export as a planned capability or launch gate, while keeping
  any distinct account-data portability or deletion decisions for a future public release.
  If users later want to share workouts with friends, scope template sharing and import around
  that concrete flow rather than reviving the full-account JSON export by default. Verify the
  Exercises screen no longer offers export and run the normal build and e2e gates.
  [Effort: 2, Value: 3, ROI: 1.50]

- [ ] Show exercise-by-exercise history — from the Exercises tab and the active logger, open a
  focused detail view for one exercise with the latest workouts and sets in set order, including
  date, reps, weight/unit, and optional RPE. Make the prior session easy to find while logging;
  do not require scanning the entire workout History. Add one clearly labeled progress summary
  (for example, heaviest completed set), calculated separately for lb and kg unless values are
  converted correctly. Handle an exercise with no history and an archived exercise already in
  past workouts. Keep the first version a readable list; a chart or extra metrics can follow only
  if they answer a question the list cannot. Cover navigation, ordering, and mixed units in
  Playwright. Fit the logger entry point to the compact set-row UI (item 1, shipped 2026-09-25,
  `docs/backlog-archive.md`) now that it's the logger's entry form.
  [Effort: 5, Value: 5, ROI: 1.00]

- [ ] Redesign the set-row entry UI for size, alignment, and low-vision accessibility — the
  active workout logger's set row (`WorkoutLogger.vue`, `.set-row`/`.set-stepper` inputs) is
  cramped: touch targets and number inputs read small and the row's elements don't align cleanly
  to a grid, giving a jagged, unpolished look. Increase input and stepper-button size and spacing
  for a comfortable tap target, and tighten column alignment across rows so reps/weight/RPE line up
  visually. Also fix a focus-usability bug: tapping into a reps or weight field that already holds
  a value from a prior set requires manually repositioning the cursor before typing, which is
  fiddly and easy to mis-tap. On focus, select the existing value (or otherwise make it trivial to
  overwrite in one keystroke) rather than requiring manual cursor placement. Larger text and
  controls should specifically help users with presbyopia/farsightedness — prioritize legible type
  size and generous hit targets over density. Verify against the visual-refresh mockup referenced
  above for consistency with the rest of the app, and cover the select-on-focus behavior in
  Playwright.
  [Effort: 3, Value: 5, ROI: 1.67]

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
