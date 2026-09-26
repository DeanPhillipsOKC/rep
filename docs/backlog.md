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

1. Item 67 — redesign active-workout screen: swipeable exercise carousel, remove "Last time" card, drop steppers, add RPE [ROI 1.0]

## Features

Design source for prior visual-refresh items: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced in
`docs/backlog-archive.md` match its canvas). Brand identity (RepBunny) is cute, functional, cool.

Items 49–55 came out of an adversarial UI/UX review (screenshot-based, another AI agent,
2026-09-25, build `v107+91aa3ab`) that was checked against the actual current source before
anything was logged — several of its claims (workout-delete confirmation, template-archive
labeling, notes-display-when-present, duplicate-submit protection) turned out to already be
implemented and were dropped rather than logged.

- [ ] **67.** Redesign the active-workout logging screen (`WorkoutLogger.vue`'s in-progress view;
  the pre-start template-selection screen isn't touched) per the canvas mockup at
  https://claude.ai/artifact/BjvWV5AFmWZsgymDR8eFj7 (`Main.dc.html`/`AddExercise.dc.html`,
  2026-09-26 — supersedes what were separately-numbered items 67/68 in earlier drafts of this entry;
  folded together because the mockup resolves them as one connected redesign, not three independent
  patches). Four pieces:
  - Replace the suggested-exercise chip row and the `<select>` exercise dropdown with a swipeable
    exercise carousel: a dot-indicator row (tap a dot to jump straight to that exercise), peek-edge
    cards hinting more exercises exist off-screen, and a persistent dashed "+" that opens a full
    add-exercise sheet (search box, then a "Recently logged" list). Rank that list by recency only
    — the app has no muscle-group/goal tagging on exercises to do a real "good for leg day"
    recommendation (see the canvas's `n4` note); don't fake it, and don't reach for AI-based
    recommendation either, that's explicitly out of scope for now.
  - Remove the "Last time" card (`.last-time`, `visiblePreviousExercises`/`previousSetsByExercise`,
    item 3) entirely — per-row reps/weight pre-fill (item 21's `matchingSet`/seed logic) already
    surfaces those numbers as the draft row's starting values, so the card is now just redundant
    space. Check first whether the pre-fill seed logic itself still needs `workout.previousWorkout`
    or those computeds before deleting them out from under it. Carry the existing exercise setup
    notes forward onto the new exercise card (`selectedExerciseNotes`/`.setup-notes`) — that's
    per-exercise "before you start the set" context (e.g. seat/pad position) that pre-fill can't
    stand in for, so it doesn't get dropped along with the card it used to sit next to.
  - Drop the reps/weight stepper buttons (`.field-row`/`.set-stepper`/`.stepper-btn`,
    `adjustReps`/`adjustWeight`, added 2026-09-25 as an overlap-bug fix, `1b3f9fe`) for compact
    tap-to-edit inline number fields, one row per set, as in the mockup. Re-enable the native
    spin-button/appearance `.set-input` currently suppresses (that suppression existed *because* the
    steppers replaced it), or leave spinners off if that's still preferred — either way, re-run the
    mobile-width Playwright checks the stepper item added (320px/375px) since this reverses what they
    cover.
  - Add an RPE column to the compact set row (dashed/dim placeholder when empty, since it's
    optional) in place of the current `+RPE` reveal-toggle button.

  Touches template markup, styles, e2e selectors for the chips/dropdown that go away, and the
  mobile-width steppers coverage — a real screen rewrite, not a small tweak.
  [Effort: 8, Value: 8, ROI: 1.0]

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
