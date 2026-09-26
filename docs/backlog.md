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

1. Item 73 — bare unstyled "Loading…" placeholders (ROI 1.5)
2. Item 75 — template exercise count goes stale after adding/removing (ROI 1.5)
3. Item 71 — allow adding a set to a past workout on the History screen (ROI 1)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

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

- [ ] Bare unstyled "Loading…" placeholder text, inconsistent with the app's branded loading
  screen (item 73, 2026-09-26 — ux-review, `04-exercises-list.png` and `19-history-list.png`):
  `ExerciseList.vue:162`, `TemplateManager.vue:203`, `WorkoutHistory.vue:156`, and
  `ExerciseHistoryDetail.vue:90` each render a plain `<p>Loading…</p>` with no styling while their
  store's `loading` flag is true — on the shared test account (hundreds of accumulated workouts)
  this sits on screen long enough to read clearly, not just flash by. `AuthGate.vue`'s own loading
  state (`:63-94`, the animated bunny badge with pulsing rings and rotating captions) shows this app
  already has a polished, on-brand loading treatment; these four list screens fall back to
  default-browser-text instead. **Decided (2026-09-26, mockup review — `https://claude.ai/artifact/9igCfxNKwXohf4FfzzVRRU`):
  skeleton rows**, not a spinner — a shared component rendering 2-3 placeholder cards matching the
  real `row-wrap` card shape (a wide bar for the title line, a narrower one below for subtext),
  filled with a shimmering gradient (`background-size: 200% 100%` sliding via `@keyframes`, tinted
  off `--surface-2`/`--border`) so the list doesn't jump in height once data arrives. Swap in for
  all four `<p>Loading…</p>` usages. [Effort: 2, Value: 3, ROI: 1.5]

- [ ] Template's "N exercises" count goes stale after adding or removing an exercise in the same
  session (item 75, 2026-09-26 — ux-review, `07-template-detail.png`, shows "0 exercises" directly
  above a list of the 2 exercises just added): `TemplateManager.vue`'s `exerciseCount()` (`:140-142`)
  reads `template.workout_template_exercises?.[0]?.count`, a cached aggregate fetched once by
  `fetchTemplates()` (`stores/templates.ts:32-45`) when the templates list loads. `addExerciseToTemplate`
  and `removeExerciseFromTemplate` (`stores/templates.ts:87-102`, `:120-128`) both update
  `exercisesByTemplate` (the expanded per-template list, which *does* show correctly) but never touch
  the `templates` array's cached count, so the header subtext stays wrong — stuck at whatever it was
  when the page first loaded — until a full reload re-fetches it. Update the matching `templates.value`
  entry's cached count (or derive the header count from `exercisesByTemplate[templateId]?.length` when
  that template's exercises have been fetched this session) in both mutation functions.
  [Effort: 2, Value: 3, ROI: 1.5]

Items 76-80 (2026-09-26, design discussion with the user): not every exercise is "reps × plate
weight." Each exercise gets a **load type** (`weight` | `level` | `bodyweight` | `assisted`) chosen
when it's created, which decides what the logger asks for and how (or whether) a set counts toward
volume. All five need the SQL in the **[human]** "Apply load-type / body-weight SQL" item under
*Human setup* applied to the live DB first, hence `Status: blocked` on each; once the user has run
it, remove the Status from all five. Document order below is also dependency order (76 and 77
before 78-80), and equal ROI/tie-break on Value/document order makes the runner take them in
that order. Decisions already made with the user, don't relitigate:
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

- [ ] Exercise load type + "Level" type (item 76, 2026-09-26): add a load-type picker to exercise
  create/edit in `ExerciseList.vue` (Weight default; Level, Bodyweight, Assisted listed but
  Bodyweight/Assisted can stay hidden until items 78/79 ship). Mirror the human SQL item's DDL into
  `supabase/schema.sql` and the `exercises`/`sets` data model in `docs/architecture.md`, and extend
  the types in `src/lib/types.ts`. For a `level` exercise, `WorkoutLogger.vue`'s set form shows a
  whole-number "Level" stepper instead of weight + lb/kg; the set saves `level = N`, `weight = 0`
  (the existing `weight not null` constraint stays). Same substitution in the set edit forms (active
  workout and `WorkoutHistory.vue`) and anywhere a set is rendered ("12 reps · Level 3", not
  "12 × 0 lb"). Volume: `src/lib/volume.ts` (`computeVolumeHistory`, both the `actual` sum and the
  per-template-exercise carry-forward) and `src/lib/progress.ts` must skip level sets entirely,
  not count them as 0 (a 0 would make a level-only workout look like a volume collapse, and a
  template exercise that's level-typed must not be treated as "skipped" for projection). PRs
  (`progress.ts`, `RecordCelebration.vue`, `exerciseHistory.ts`): for a level exercise, a set beats
  the previous best if it's at a higher level, or the same level with more reps. Changing an
  exercise's load type once it has any logged sets is blocked in the UI with a short explanation
  (its history would be misread); archive + recreate is the escape hatch. Extend the e2e specs to
  create a level exercise, log a set, and check it renders as a level and doesn't move the volume
  chart. [Effort: 5, Value: 5, ROI: 1, Status: blocked: needs the load-type SQL (human item) applied to the live DB]

- [ ] "Body" tab: body-weight and height tracking (item 77, 2026-09-26): prerequisite for items
  78/79's volume math (assisted machines are counterweighted, so the work done depends on what the
  lifter weighs). Data: new `body_weight_entries` table plus `profiles.height`/`height_unit` (DDL
  in the human SQL item; mirror into `supabase/schema.sql`, `supabase/policies.sql`, and
  `docs/architecture.md`, owner-only RLS like `push_subscriptions`) and a small store. Height is a
  single profile value (it rarely changes, so no history); body weight is a dated log.
  - **New fifth tab "Body"** in `BottomNav.vue` (after Exercises, same icon/label pattern; a
    simple person/scale glyph) with its own route. Screen shows: current body weight and when it
    was last entered, a button to log a new weight (number + lb/kg, saves a new dated entry),
    height (ft/in or cm, editable), **BMI** computed from latest weight + height (kg / m², one
    decimal, with the standard category label: under 18.5 underweight, 18.5-24.9 normal, 25-29.9
    overweight, 30+ obese; shown only when both values exist, otherwise a prompt to fill in the
    missing one), and a small body-weight-over-time chart once there are 2+ entries (reuse the
    `VolumeChart.vue` styling). Empty state explains why it's worth filling in (bodyweight and
    assisted exercises count toward volume). Check the five-tab bar still fits at 360px width.
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
  [Effort: 5, Value: 5, ROI: 1, Status: blocked: needs the load-type SQL (human item) applied to the live DB]

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
  added weight as tiebreak). Set rendering: "12 reps · bodyweight" or "8 reps · BW + 25 lb". Unhide
  the Bodyweight option in item 76's picker. Extend e2e. [Effort: 3, Value: 3, ROI: 1, Status: blocked: needs the load-type SQL (human item) applied to the live DB]

- [ ] "Assisted" load type (item 79, 2026-09-26, depends on items 76 and 77): counterweighted
  assisted pull-up/dip machines, where a bigger number means an easier set. Logger field is labeled
  "Assist" (stored in `weight`/`weight_unit`). Effective load = max(body weight − assist, 0); volume
  = reps × effective load, with the same "excluded from volume, plus `BodyStatsModal` prompt"
  behavior as item 78 when no body weight is on file (reuse item 78's composable, including its
  "Don't ask again" opt-out). PRs run **inverted** when body weight is unknown: less assist beats
  more, ties broken by more reps; with body weight known, compare effective-load volume. Progress/history
  views must not show a rising assist number as improvement: check `ExerciseHistoryDetail.vue` and
  `exerciseHistory.ts` for any "heavier is better" assumptions. Set rendering: "10 reps · 40 lb
  assist". Unhide the Assisted option in item 76's picker. Extend e2e.
  [Effort: 3, Value: 3, ROI: 1, Status: blocked: needs the load-type SQL (human item) applied to the live DB]

- [ ] Periodic "update your weight" reminder (item 80, 2026-09-26, depends on item 77): once a
  user has **both** a body weight and a height on file, remind them to log a fresh weight when
  their latest `body_weight_entries.recorded_at` is older than their cadence,
  `profiles.weight_reminder` (`'weekly'` = 7 days, `'monthly'` = 30 days, `'off'`; default
  `'monthly'`, changeable in item 77's Reminders section). Check on app open, on the Home screen
  only. Never interrupt an in-progress workout: if one is active, wait until the next open without
  one. Show item 77's `BodyStatsModal.vue` in "update" mode (short "Time for a weigh-in?" line,
  weight prefilled with the last value, height hidden). "Save" logs a new entry. "Not now" snoozes
  for 3 days (per-device localStorage is fine for the snooze, wrapped in try/catch; worst case it
  asks again sooner). "Don't ask again" sets `weight_reminder = 'off'`. Keep the due/snooze
  decision in a pure, unit-tested function (inputs: latest entry date, cadence, snooze-until, has
  height, now). e2e: seed an old weight entry, open the app, see the prompt, choose "Don't ask
  again," reload, no prompt. [Effort: 3, Value: 3, ROI: 1, Status: blocked: needs the load-type SQL (human item) applied to the live DB]

## Testing / tooling

(none open)

## Human setup / device verification

- [ ] **[human]** Apply load-type / body-weight SQL (2026-09-26, prerequisite for items 76-80):
  run this in the Supabase SQL editor, then remove the `Status: blocked` from items 76-80 so the
  runner picks them up. Additive only; existing exercises default to `weight` and behave exactly
  as today.
  ```sql
  alter table exercises add column load_type text not null default 'weight'
    check (load_type in ('weight', 'level', 'bodyweight', 'assisted'));
  alter table sets add column level int null check (level is null or level > 0);
  alter table profiles add column height numeric null check (height is null or height > 0);
  alter table profiles add column height_unit text null check (height_unit in ('in', 'cm'));
  alter table profiles add column missing_weight_prompt_opt_out boolean not null default false;
  alter table profiles add column weight_reminder text not null default 'monthly'
    check (weight_reminder in ('weekly', 'monthly', 'off'));

  create table body_weight_entries (
    id          uuid primary key default gen_random_uuid(),
    user_id     uuid not null references profiles(id),
    weight      numeric not null check (weight > 0),
    weight_unit text not null check (weight_unit in ('lb', 'kg')),
    recorded_at timestamptz not null default now()
  );
  alter table body_weight_entries enable row level security;
  create policy "own rows only" on body_weight_entries
    for all
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);
  ```

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
