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

1. Item 84 — stale/cross-account data flashes on Home after switching accounts (ROI 1.67)
2. Item 77 — "Body" tab: body-weight and height tracking (ROI 1)
3. Item 71 — allow adding a set to a past workout on the History screen (ROI 1)
4. Item 78 — "Bodyweight" load type (ROI 1)
5. Item 79 — "Assisted" load type (ROI 1)
6. Item 80 — periodic "update your weight" reminder (ROI 1)
7. Item 81 — weigh-in history: view, fix, and delete entries (ROI 1)
8. Item 83 — migrate remaining e2e fixture setup to API seeding; benchmark 4 workers (ROI 1)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

- [ ] Stale/cross-account data flashes on Home right after switching accounts on the same device
  (item 84, 2026-09-26, reported by the user while testing item 76 with their alternate/test
  account): signed out of the real account, signed back in with a passkey as the alt account, and
  the Home screen's progress strip showed the *real* account's actual workout data, while History
  and Templates (visited right after) were correctly empty for the alt account. Two candidate
  causes, not yet distinguished — whoever picks this up needs to reproduce with logging/network
  inspection to tell which (or both) it is before fixing:
  1. **Stale Pinia state, never cleared on sign-out.** `AuthGate.vue`'s sign-out watcher only calls
     `workout.resetActiveWorkoutState()` (`stores/workouts.ts`) — it doesn't touch that store's
     `history`, `workoutsThisWeek`, `workoutDaysThisWeek`, `recentPr`, `exerciseHistory`,
     `volumeHistory`, `recentlyLoggedExerciseIds`, or the in-memory `bestMarkerCache`, nor
     `exercises.ts`'s `exercises` or `templates.ts`'s `templates`/`exercisesByTemplate`. Since
     Pinia stores are app-lifetime singletons and this is an SPA (no full page reload on sign-out),
     whatever the previous account last fetched stays in memory until something overwrites it.
     This alone doesn't fully explain the report, though: `WorkoutLogger.vue`'s `onMounted` calls
     `workout.fetchProgressStats()` unconditionally (not guarded by an empty-check like the
     exercises/templates fetches next to it), so Home's progress strip should have been
     overwritten by a fresh, correctly-RLS-scoped (and so correctly empty) fetch for the alt
     account on remount — unless remount itself didn't happen (worth confirming whether
     `AuthGate.vue`'s `v-if`/`v-else` swap actually unmounts/remounts the router-view's tree across
     a sign-out → sign-in transition, rather than Vue reusing component instances).
  2. **Session-swap race.** If it does remount and does refetch, but the query still returned the
     old account's real rows (not just stale cached UI), the Supabase client's session must not
     have fully switched over yet when that fetch fired — i.e. a real network read still
     authenticated as the old account for a brief window after `signInWithPasskey()` resolves but
     before `onAuthStateChange` (or the client's internal token swap) has settled. That's a
     different, more subtle fix (e.g. don't fire any data fetch until the new session is confirmed
     current) than "just clear the caches."
  Low real-world impact (the two pilot users don't share a device), but it's the kind of gap
  `docs/architecture.md`'s "secure by default" constraint and its hostile-read RLS test exist to
  catch, and it's actively getting in the way of using the alt/test account for manual QA on the
  same device. [Effort: 3, Value: 5, ROI: 1.67]

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

Items 76-81 (2026-09-26, design discussion with the user): not every exercise is "reps × plate
weight." Each exercise gets a **load type** (`weight` | `level` | `bodyweight` | `assisted`) chosen
when it's created, which decides what the logger asks for and how (or whether) a set counts toward
volume. **Schema is already live** (user applied it 2026-09-26) and mirrored into
`supabase/schema.sql`, `supabase/policies.sql`, and the `docs/architecture.md` data model, so none
of these items needs DDL. Document order below is also dependency order (76 and 77 before 78-81),
and equal ROI/tie-break on Value/document order makes the runner take them in that order. **Design source:** private canvas mockup at
https://claude.ai/artifact/KKgHc6kBSGawfboGGE2TMd (2026-09-26; artboard titles name the item each
frame belongs to). Match its layout, copy, and set-label formats unless the item text says
otherwise. Decisions already made with the user, don't relitigate:
- Level exercises are **excluded from volume entirely** (difficulty levels aren't linear, so no
  "each level ≈ X lb" scale factor). They still get per-exercise progress and PRs.
- Levels are whole numbers (every machine the user has seen); revisit only if one turns up that isn't.
- Body weight is tracked as a dated log, not a single profile field, so old sets keep the body
  weight the user had at the time instead of shifting whenever it's updated. It lives on a new
  "Body" bottom-nav tab alongside height and BMI.
- When body weight is missing, bodyweight/assisted exercises prompt for it with a modal every
  workout, with "Not now" and "Don't ask again"; the user can always decline, and those sets then
  just stay out of volume.
- Users with a weight and height on file get a periodic weigh-in reminder (weekly or monthly),
  also with "Don't ask again."
- Five bottom-nav tabs is fine (icons are small); if it ever looks cluttered, that's a separate
  UX pass, not a reason to drop the tab.
- Timed/cardio exercises (treadmill speed × time, planks) are out of scope for now.

- [ ] "Body" tab: body-weight and height tracking (item 77, 2026-09-26): prerequisite for items
  78/79's volume math (assisted machines are counterweighted, so the work done depends on what the
  lifter weighs). Data: the already-live `body_weight_entries` table (owner-only RLS) plus
  `profiles.height`/`height_unit`, `missing_weight_prompt_opt_out`, and `weight_reminder`; add a
  small store over them. Height is a single profile value (it rarely changes, so no history); body
  weight is a dated log.
  - **New fifth tab "Body"** in `BottomNav.vue` (after Exercises, same icon/label pattern; a
    simple person/scale glyph) with its own route. Screen shows: current body weight and when it
    was last entered, a button to log a new weight (number + lb/kg, saves a new dated entry),
    height (ft/in or cm, editable), **BMI** computed from latest weight + height (kg / m², one
    decimal, with the standard category label: under 18.5 underweight, 18.5-24.9 normal, 25-29.9
    overweight, 30+ obese; shown only when both values exist, otherwise a prompt to fill in the
    missing one), and a small body-weight-over-time chart once there are 2+ entries (reuse the
    `VolumeChart.vue` styling). Empty state explains why it's worth filling in (bodyweight and
    assisted exercises count toward volume) and shows `public/body-bunny.png` (bunny stepping
    onto a scale, ~150px tall, centered above the "Add your stats" heading, `alt=""` since it's
    decorative) as in the mockup's first-visit artboard. Only the empty state gets the art; the
    filled Body screen stays data-only. Check the five-tab bar still fits at 360px width.
  - **Reusable `BodyStatsModal.vue`**: height + current weight fields prefilled with whatever is
    already on file, with "Save", "Not now", and "Don't ask again" buttons (the modal just emits
    which one was chosen; callers decide what each means). Built here, triggered by items 78-80.
  - A "Reminders" section on the Body screen with the toggles items 78 and 80 need to undo a
    "Don't ask again": "Ask for my weight when logging bodyweight/assisted exercises" and the
    weight-update reminder's cadence (Weekly / Monthly / Off). Items 78 and 80 wire them up;
    this item can render them from the profile columns already.
  - Expose one pure helper, e.g. `bodyWeightAt(entries, performedAt, unit)`: the latest entry
    recorded at or before `performedAt`, falling back to the earliest entry if none is that old (so
    entering a body weight today still covers sets logged last week), converted to `unit` (1 kg =
    2.20462 lb), or `null` if there are no entries at all. Unit-test it along with the BMI math.
  - e2e: navigate to Body, enter height + weight, see BMI; log a second weight, see the chart.
  [Effort: 5, Value: 5, ROI: 1]

- [ ] "Bodyweight" load type (item 78, 2026-09-26, depends on items 76 and 77): push-ups, pull-ups,
  dips. Logger shows reps plus an optional "Added weight" field (vest/dip belt; defaults to 0,
  stored in `weight`/`weight_unit` as today). Effective load per set = body weight at the workout's
  `performed_at` (item 77's helper, in the set's unit) + added weight; volume = reps × effective
  load, so these do count toward the volume chart. If no body weight has been entered, the set is
  excluded from volume (same "skip, not zero" rule as item 76's level sets). **Missing body weight
  prompt:** open item 77's `BodyStatsModal.vue` (a) right after the user creates a bodyweight or
  assisted exercise, and (b) when they log the first bodyweight/assisted set of a workout, in both
  cases only if no body weight is on file. The user can always decline and nothing is blocked: the
  set still saves, it just stays out of volume. **"Not now"** suppresses it for the rest of that
  workout; it comes back next workout. **"Don't ask again"** sets
  `profiles.missing_weight_prompt_opt_out = true` (on the profile, not localStorage, so it holds on
  every device) and the modal never opens for this reason again; item 77's Body screen gets a
  toggle to turn the prompt back on. Share this trigger logic with item 79 (one composable), don't
  duplicate it. PRs use effective-load volume when body weight is known, otherwise most reps (with
  added weight as tiebreak). Set rendering: "10 × BW" or "8 × BW + 25 lb". Unhide
  the Bodyweight option in item 76's picker. Extend e2e. [Effort: 3, Value: 3, ROI: 1]

- [ ] "Assisted" load type (item 79, 2026-09-26, depends on items 76 and 77): counterweighted
  assisted pull-up/dip machines, where a bigger number means an easier set. Logger field is labeled
  "Assist" (stored in `weight`/`weight_unit`). Effective load = max(body weight − assist, 0); volume
  = reps × effective load, with the same "excluded from volume, plus `BodyStatsModal` prompt"
  behavior as item 78 when no body weight is on file (reuse item 78's composable, including its
  "Don't ask again" opt-out). PRs run **inverted** when body weight is unknown: less assist beats
  more, ties broken by more reps; with body weight known, compare effective-load volume. Progress/history
  views must not show a rising assist number as improvement: check `ExerciseHistoryDetail.vue` and
  `exerciseHistory.ts` for any "heavier is better" assumptions. Set rendering: "10 × 40 lb
  assist". Unhide the Assisted option in item 76's picker. Extend e2e.
  [Effort: 3, Value: 3, ROI: 1]

- [ ] Periodic "update your weight" reminder (item 80, 2026-09-26, depends on item 77): once a
  user has **both** a body weight and a height on file, remind them to log a fresh weight when
  their latest `body_weight_entries.recorded_at` is older than their cadence,
  `profiles.weight_reminder` (`'weekly'` = 7 days, `'monthly'` = 30 days, `'off'`; default
  `'monthly'`, changeable in item 77's Reminders section). Check on app open, on the Home screen
  only. Never interrupt an in-progress workout: if one is active, wait until the next open without
  one. Show item 77's `BodyStatsModal.vue` in "update" mode (short "Time for a weigh-in?" line,
  weight prefilled with the last value, height hidden), with `public/body-bunny.png` (~128px
  tall, `alt=""`) peeking over the sheet's top-right edge as in the mockup's weigh-in artboard.
  The missing-weight prompt from items 78/79 does **not** get the art (it appears mid-workout and
  should stay lean), so make the image an opt-in prop on `BodyStatsModal.vue`. "Save" logs a new entry. "Not now" snoozes
  for 3 days (per-device localStorage is fine for the snooze, wrapped in try/catch; worst case it
  asks again sooner). "Don't ask again" sets `weight_reminder = 'off'`. Keep the due/snooze
  decision in a pure, unit-tested function (inputs: latest entry date, cadence, snooze-until, has
  height, now). e2e: seed an old weight entry, open the app, see the prompt, choose "Don't ask
  again," reload, no prompt. [Effort: 3, Value: 3, ROI: 1]

- [ ] Weigh-in history: view, fix, and delete body-weight entries (item 81, 2026-09-26, depends on
  item 77): a mistyped weight (18.5 instead of 185) silently corrupts bodyweight/assisted volume for
  every workout after it, so entries must be correctable. The Body screen's "See all weigh-ins"
  link (mockup, "Body tab" artboard, below the Reminders card) opens a list of every
  `body_weight_entries` row, newest first: weight + unit, date, and the change from the previous
  entry. It's a **bottom-sheet overlay over the Body tab**, not a new route: same shell as
  `ExerciseHistoryDetail.vue` (dimmed backdrop, rounded-top panel, close button). Mockup artboard
  "All weigh-ins: edit, typo check, delete (item 81)" shows every state. Each row gets Edit
  (weight, unit, and date, same inline-flyout pattern as `ExerciseList.vue`'s edit form) and Delete
  (inline confirm row, same pattern as the exercise delete, noting that volume for affected
  workouts will be recalculated). Flag likely typos on save, both here and in item 77's log-weight
  form and `BodyStatsModal.vue`: if a new value differs from the previous entry by more than 20%,
  don't save yet; show an **inline warning box under the field** (Carrot Gold `--highlight` tint,
  field border turns gold): "That's a big change from 185.4 lb. Save anyway?" with "Fix it"
  (primary, refocuses the field) and "Save anyway". Build it as one small shared component so all
  three places look identical. Since volume
  is computed at read time from these entries, a fix corrects past workouts' volume automatically;
  make sure any cached volume/PR data in the stores is refetched after an edit or delete. Extend
  item 77's store with update/delete. e2e: log two weights, edit one, delete one, confirm the list
  and the Body screen's current value update. [Effort: 3, Value: 3, ROI: 1]

## Testing / tooling

- [ ] Migrate remaining e2e fixture setup to API seeding; benchmark 4 workers (item 83, 2026-09-26,
  follow-up to item 82's regression-gate speedup, `docs/backlog-archive.md`): item 82 shipped
  per-worker auth reuse (one magic-link mint per worker instead of ~50 per run), 2 parallel workers
  with isolated per-worker test accounts, parallelized independent lookups in
  `scripts/lib/cleanup-e2e-stamp.mjs`, and removed a handful of confirmed-wasted 2-second blind waits
  in `e2e/fixtures/exercise.ts`/`celebration.ts` — measured 70% median wall-clock reduction (3
  baseline runs averaging 6.8min, 3 post-change runs averaging 2.0min), comfortably past that item's
  50% target, with all 57 tests green across every measured run. Not done, and out of this item's
  original scope by the time it shipped:
  - Most specs still create their fixture exercises/templates by driving the UI (`Add exercise`,
    `Add template` flows) rather than seeding via the admin client directly, even where creation
    itself isn't the behavior under test — item 82's own text called this out but it was never
    started. Audit which specs' setup this applies to (excluding ones that specifically test the
    creation UI, e.g. `exercise-create-full.spec.ts`, `templates.spec.ts`) and seed via
    `getAdminClient()` the same way `progress-strip.spec.ts`/`resume-after-finish.spec.ts` already do
    through `signInAsTestUser`'s `beforeNavigate` hook.
  - Only 2 workers were benchmarked (see `docs/architecture.md#testing--automation`). Benchmark 4
    with `PW_WORKERS=4 npm run test:e2e` — watch for Supabase `generateLink`/`verifyOtp` rate
    limiting across 4 simultaneous per-worker mints, and re-check whether `timeout`/`retries` in
    `playwright.config.ts` need further adjustment under the extra load.
  - Concurrent invocations of `npm run test:e2e` (e.g. a manual run overlapping a
    `scripts/Run-Backlog.ps1` iteration) were deliberately left unsupported rather than solved, to
    avoid minting a fresh Supabase auth user per run on the free tier — confirm this is still the
    right tradeoff if usage patterns change, rather than assuming it's been verified safe.
  [Effort: 3, Value: 3, ROI: 1]

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
