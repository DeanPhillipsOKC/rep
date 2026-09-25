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

1. Primary calls to action get lost against secondary/ghost buttons (ROI 1.67)
2. Show compact logging rows matching the exercise's configured set count (ROI 1.60)
3. Recover an interrupted workout after reload (ROI 1.60)
4. Make failed set saves safe to retry (ROI 1.60)
5. Export personal training data (ROI 1.00)
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

- [ ] Show compact logging rows matching the exercise's configured set count — user-requested
  2026-09-25. Replace the large one-set-at-a-time form in `WorkoutLogger.vue` with numbered
  rows visible together on a phone, each with quick-entry reps and weight fields. For a
  template workout, use that exercise's `target_sets` (two configured sets means two rows;
  three means three). If no count is configured, start with one row and allow more to be added.
  Include optional RPE in each row if it stays readable and easy to tap at mobile width;
  otherwise keep RPE accessible through a compact per-row expansion. Keep the weight unit
  easy to set without repeating a full-width selector in every row. Pre-fill from the
  previous workout where available, while keeping each row independently editable.
  Completing a row saves that set and starts the existing rest flow for that exercise;
  later rows stay visible and ready to edit during rest. Empty planned rows must not be
  saved. Allow adding or removing rows when the actual workout differs from the configured
  count, and preserve editing/deleting logged sets. Cover the mobile layout,
  sequential saves, and rest behavior in Playwright.
  [Effort: 5, Value: 8, ROI: 1.60]

- [ ] Primary calls to action get lost against secondary/ghost buttons — user-reported
  2026-09-25 (example: the "Log another workout" button shown on the post-workout volume
  chart in `WorkoutLogger.vue` reads as muted/secondary and is easy to miss). Root cause:
  `WorkoutLogger.vue` applies `.ghost` (transparent background, `--border` outline,
  `--text-dim` text — see `src/style.css`'s `.ghost` rule) to at least two primary CTAs
  instead of the accent (Bunny Pink / "dusty rose", `--accent` in `src/style.css`) fill
  they should have: `chart-dismiss` "Log another workout" (`WorkoutLogger.vue:468`) and
  "Finish workout" (`WorkoutLogger.vue:749`, currently `class="ghost finish"`). Fix: swap
  both to the accent fill (`background: var(--accent); border-color: var(--accent); color:
  var(--accent-text)` — matches `button[type='submit']` in `style.css` and the several
  per-component accent buttons already in `RecordCelebration.vue`, `RestTimer.vue`, etc.).
  While in there, sweep other components for primary actions currently styled `.ghost` or
  plain `button` that should read as the main next step, not just these two. Worth
  introducing a shared `.btn-accent`/primary class in `style.css` at this point rather than
  redefining the accent fill per component again, since it's already duplicated 6+ times.
  [Effort: 3, Value: 5, ROI: 1.67]

- [ ] Recover an interrupted workout after reload — the current active workout ID, template,
  elapsed timer, and sets live only in the Pinia store, so a refresh or installed-PWA relaunch
  loses the live session even though its rows remain in Supabase. Persist only an account-scoped
  active workout reference locally after `startWorkout` succeeds. On app load, fetch that workout
  and its sets through the signed-in user's normal Supabase client, then offer explicit Resume
  and Discard actions. Restore the template, notes, start time (`performed_at`), and server-ordered
  sets; do not trust a cached set list or create a second workout. Clear the local reference on
  successful finish/discard/sign-out and when the referenced row no longer exists or belongs to
  another account. Require confirmation before discarding a recovered workout, including one
  with saved sets, and ensure saved sets are never silently deleted. Scope is same-device
  recovery; cross-device resume and a new `finished_at` migration can be considered later.
  Cover reload with saved sets, reload before the first set, finish/discard, and a stale reference
  in Playwright. No schema change or human setup is needed for this first recovery step.
  [Effort: 5, Value: 8, ROI: 1.60]

- [ ] Make failed set saves safe to retry — `WorkoutLogger.vue` currently surfaces a raw error
  while the user is mid-workout. Keep the attempted exercise/reps/weight/unit/RPE visible, show a
  short actionable message and Retry control, and never mark a set complete or start rest until
  its save is confirmed. A network timeout can happen after the insert reached Supabase, so a
  retry must use a stable client-generated set ID (or equivalent idempotency key) and reconcile
  with the server before treating a duplicate-key response as success; blindly inserting again
  would double-count a lift. If reconciliation finds the original set already saved, show that
  saved row and let the user use normal set editing for corrections; otherwise retry the current
  field values. Keep the action disabled while one attempt is in flight. Cover a definite server
  rejection, a lost/uncertain response followed by retry, and exactly one persisted set in
  Playwright. This is online error recovery, not an offline write queue; revisit durable offline
  logging after real gym-device feedback. Depends on the compact set-row item so the retry
  affordance fits its final row UI.
  [Effort: 5, Value: 8, ROI: 1.60]

- [ ] Export personal training data — add a discoverable download action for the signed-in user
  that produces versioned JSON containing their exercises (including archived names/notes),
  templates and exercise order/targets, workouts and notes/timestamps, and sets with units/RPE.
  Use the normal authenticated Supabase client and explicit pagination so a history over the
  default 1,000-row API page limit is complete. Do not export auth tokens, push subscriptions, or
  another account's rows. Give the file a dated name and show a useful error if any fetch fails
  rather than downloading a partial backup. Add a Playwright download check with seeded records
  and a separate verification of pagination/completeness. No import UI is in scope.
  [Effort: 5, Value: 5, ROI: 1.00]

- [ ] Show exercise-by-exercise history — from the Exercises tab and the active logger, open a
  focused detail view for one exercise with the latest workouts and sets in set order, including
  date, reps, weight/unit, and optional RPE. Make the prior session easy to find while logging;
  do not require scanning the entire workout History. Add one clearly labeled progress summary
  (for example, heaviest completed set), calculated separately for lb and kg unless values are
  converted correctly. Handle an exercise with no history and an archived exercise already in
  past workouts. Keep the first version a readable list; a chart or extra metrics can follow only
  if they answer a question the list cannot. Cover navigation, ordering, and mixed units in
  Playwright. Depends on the compact set-row item so the logger entry point fits that layout.
  [Effort: 5, Value: 5, ROI: 1.00]

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
