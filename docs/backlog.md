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

1. Remove JSON training data export (ROI 1.50)
2. Orphaned freeform `workouts` rows leak permanently and aren't covered by any existing check (ROI 1.33)
3. Show exercise-by-exercise history (ROI 1.00)
4. Flaky click on "Start workout" in `template-or-freeform-choice.spec.ts`'s second run (ROI 1.00)

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

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

## Testing / tooling

- [ ] Orphaned freeform `workouts` rows leak permanently and aren't covered by any existing check —
  found while confirming a since-shipped fix's kill-mid-run hypothesis (e2e-stamped-row cleanup
  resilience, `docs/backlog-archive.md`): a query for `workouts` with no `notes`, no `template_id`,
  and no `sets` turned up 116 rows on the shared test account spanning the entire day (13:09
  through the current run), well before this session started. Root cause: some specs (confirmed:
  `exercise-notes.spec.ts`) start a freeform workout via the UI to reach a later assertion (e.g.
  checking setup notes render while logging) but never call Finish or Discard, so the `workouts`
  row — created with `notes: null`, no template — persists forever. Neither
  `scripts/check-e2e-leaks.mjs` nor `scripts/sweep-stale-e2e-rows.mjs` (both from that same fix)
  can see these: both key off an `E2E`-tagged `name`/`notes` string, and these rows have neither.
  Not urgent (116 rows in a day is nowhere near PostgREST's 1000-row truncation point, and they
  don't affect any current test's assertions — verified while fixing 5 unrelated specs that broke
  when the *other* leak category was swept to zero for the first time), but the same
  silent-accumulation mechanism given enough time. Fix options: (a) audit specs that start a
  workout and add a Finish+Discard/Finish+set at the end, mirroring `docs/backlog-archive.md` item
  56's fix to `archived-template-exercise.spec.ts` for the same pattern; or (b) extend the sweep
  script with a *second*, narrowly-scoped pass that deletes `workouts` with no notes/template/sets,
  older than the same threshold, filtered to the test account's own `user_id` specifically (never a
  blanket `notes IS NULL` sweep — that shape of row is exactly what a real pilot user's
  abandoned-mid-workout freeform session looks like too, and must never be touched). Left uncleaned
  for now rather than bulk-deleting 116 rows via an ad hoc script outside reviewable tooling.
  [Effort: 3, Value: 4, ROI: 1.33]

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
