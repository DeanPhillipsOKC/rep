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

1. Show exercise-by-exercise history (ROI 1.00)
2. Flaky click on "Start workout" in `template-or-freeform-choice.spec.ts`'s second run (ROI 1.00)
3. Flaky click on "Start workout" in `volume-chart.spec.ts` (ROI 1.00)
4. Flaky "exercise-row not visible" in `resume-after-finish.spec.ts` (ROI 1.00)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

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

## Testing / tooling

- [ ] Flaky click on "Start workout" in `template-or-freeform-choice.spec.ts`'s second run — found
  while shipping the mid-workout suggested-chip sizing fix (`docs/backlog-archive.md`): a full
  `npm run test:e2e` run failed this spec with `Test timeout of 30000ms exceeded` clicking
  `Start workout` for the follow-up freeform start (after "Log another workout" resets the start
  screen back to unselected), with Playwright's action log reporting `element was detached from
  the DOM, retrying` before giving up. Unrelated to the chip-sizing change (different feature area
  — start-screen template/freeform chips, not the mid-workout `.suggested` exercise chips) and
  passed cleanly on an immediate rerun in isolation, so treated as a pre-existing flake per
  `docs/backlog-archive.md` items 56/57's documented pattern rather than blocking that ship. Root
  cause not yet diagnosed — likely a re-render racing the click right as the post-finish reset
  flips the start screen back to its unselected state. Investigate and make the click robust (wait
  for the reset to settle, or find and fix the actual re-render race) so this stops intermittently
  failing the full e2e gate.
  [Effort: 3, Value: 3, ROI: 1.00]

- [ ] Flaky click on "Start workout" in `volume-chart.spec.ts` — found while shipping the JSON
  training-data export removal (item 60, `docs/backlog-archive.md`): a full `npm run test:e2e` run
  failed `volume chart: under-completed exercise carries forward its last complete volume` with
  `Test timeout of 30000ms exceeded` clicking `Start workout`, Playwright's action log reporting
  `element was detached from the DOM, retrying` before giving up — the same symptom already tracked
  for `template-or-freeform-choice.spec.ts` above, but in a different spec, so logged separately per
  that item's own scope. Unrelated to the export-removal change (different feature area — start
  screen template selection, not Exercises/export) and passed cleanly on an immediate rerun in
  isolation, so treated as a pre-existing flake per `docs/backlog-archive.md` items 56/57's
  documented pattern rather than blocking that ship. Likely the same root cause as the sibling item
  above (a re-render racing the "Start workout" click); fix both together once diagnosed, or confirm
  they're actually the same bug and merge the items.
  [Effort: 3, Value: 3, ROI: 1.00]

- [ ] Flaky "exercise-row not visible" in `resume-after-finish.spec.ts`'s templated-workout resume
  test — found while shipping the orphaned-freeform-workout sweep-script fix (item 62): a full
  `npm run test:e2e` run failed `resume after finish: templated workout offers resume after the
  volume chart, and Start a new workout dismisses it` waiting on `.exercise-row` containing the
  newly-added exercise name to become visible (5000ms timeout, element never found) right after
  clicking "Add" to attach the exercise to the template. Unrelated to the sweep-script change
  (different feature area — template exercise attachment, not e2e cleanup tooling) and passed
  cleanly on an immediate rerun in isolation (`npx playwright test e2e/resume-after-finish.spec.ts`,
  3/3 passed), so treated as a pre-existing flake per `docs/backlog-archive.md` items 56/57's
  documented pattern rather than blocking that ship. Root cause not yet diagnosed — likely a
  re-render race between the template detail view refetching its exercise list and the "Add"
  click's response, similar in shape to the two already-tracked "Start workout" flakes above but in
  a different UI area. Investigate and make the assertion/click robust so this stops intermittently
  failing the full e2e gate.
  [Effort: 3, Value: 3, ROI: 1.00]

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
