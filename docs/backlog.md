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

50, 53, 52, 57, 54

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 below came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged. What's below is what verifiably still needs doing.

- [ ] **Item 50 — Active workout has no visible "in progress" state.** `WorkoutLogger.vue`'s
  heading is hard-coded to "Log a workout" whether or not a workout is active, and `BottomNav`
  keeps Home selected throughout (same route). Add a dynamic header (template name + elapsed
  time) while a workout is active. Note this is bigger than just UI: `activeWorkoutId` lives
  only in an in-memory Pinia ref with no persistence, and the `workouts` table has no
  "finished" flag, so there's currently no way to tell an abandoned session from a finished one
  at the DB level — true resume-after-refresh needs a schema change (`finished_at` or similar),
  which is a human-executed migration per `docs/architecture.md`'s DDL constraint. Scope the
  in-session header/timer work now; treat cross-refresh resume as a follow-on once that
  migration lands. Also worth folding in while touching this screen: the quick-pick exercise
  chips and the exercise `<select>` do the exact same thing (set `exerciseId`) with no visual
  relationship, which the review correctly flagged as confusing. `[Effort: 5, Value: 8, ROI: 1.6]`

- [ ] **Item 53 — Volume/projection chart doesn't explain "Projected."** `VolumeChart.vue`
  shows an Actual/Projected legend and line, but the carry-forward logic in
  `src/lib/volume.ts` (an incomplete template exercise's contribution gets replaced by its last
  known volume) is never explained in the UI, and the chart has no axis or unit (lb/kg) label.
  Note the review's other volume-chart claims didn't hold up — `fetchTemplateVolumeHistory`
  already scopes to the same template and isn't capped at two points, so this is just a
  copy/labeling fix, not a data-model one. `[Effort: 2, Value: 3, ROI: 1.5]`

- [ ] **Item 52 — Rest timer has no manual adjustment or non-destructive return.** `RestTimer.vue`
  is already `endsAt`-timestamp-driven with a push-notification fallback for backgrounding (the
  review's core technical worry here was already solved), but it has no ±15s adjust and `Skip
  Rest` is the only way back to the workout — which cancels the timer rather than letting it
  keep running in the background while you go check something. `[Effort: 3, Value: 4, ROI: 1.33]`

- [ ] **Item 54 — Template creation form permanently occupies the top of the Templates tab.**
  `TemplateManager.vue` renders the "Add template" form as a persistent card above the list.
  Replace with a button/sheet that opens it on demand. Keep the existing up/down reorder
  buttons rather than switching to drag handles — they're the more accessible choice on mobile
  without a keyboard-equivalent drag affordance, so the review's specific recommendation there
  isn't being adopted. `[Effort: 3, Value: 3, ROI: 1]`

## Testing / tooling

- [ ] **Item 57 — e2e specs never clean up or seed their own data; refactor to stop
  accumulating permanent rows on the shared test account.** Root-causing item 56 (see
  `docs/backlog-archive.md`) found the test account sitting on 1437 `exercises` rows and 1060+
  `workouts` rows — years of stamped (`E2E … <timestamp>`) test data that almost no spec ever
  deletes, since the suite's collision-avoidance strategy (unique names per run) never included
  teardown. That's already large enough to silently truncate unbounded `.select()` queries at
  Supabase/PostgREST's default 1000-row page size, which is what actually caused item 56's
  "random" failures — reproduced directly: `template-archive-confirm.spec.ts` alone went
  fail/pass/fail across three back-to-back isolated runs once `exercises` crossed that
  threshold, no other spec involved. `npm run wipe:account -- test-automation@example.com`
  (item 5) resets the account today, but nothing stops it from silently re-bloating past 1000
  again over months of normal use. Fix properly: give specs an `afterEach` (or a shared fixture)
  that deletes what that test created via the admin client (`getAdminClient()`,
  `scripts/lib/mint-test-session.mjs`), keyed off each test's own stamp rather than a blanket
  wipe; and where a spec needs pre-existing state (e.g. `pre-fill.spec.ts`'s "last workout of the
  same template"), seed it directly via the admin client instead of driving the UI just to set up
  fixture data. `[Effort: 5, Value: 5, ROI: 1]`

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
- [ ] **[human]** Drop the now-unused `category` column from the live `exercises` table (item 30, shipped 2026-09-24, `docs/backlog-archive.md`): run `alter table exercises drop column category;` in the Supabase SQL editor. Code no longer reads or writes it either way, so this is cleanup, not a blocker.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
