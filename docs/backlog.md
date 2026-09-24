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
| 22 | Exercise creation only captures name/category — notes and rest timer need a separate edit trip | 2 | 2 | 1 |
| 25 | Archiving an exercise doesn't remove it from templates it's already attached to | 3 | 3 | 1 |
| 28 | In-app rest timer screen: animated bunny, cooldown progress bar, skip option | 5 | 5 | 1 |
| 29 | Rotating words-of-encouragement copy on the rest timer screen | 2 | 2 | 1 |
| 24 | Redesign exercise row actions into pencil/trash icons instead of four text buttons | 5 | 3 | 0.6 |

## Features

### 22. Exercise creation only captures name/category — notes and rest timer need a separate edit trip `[Effort: 2, Value: 2, ROI: 1]`

Reported 2026-09-25. `ExerciseList.vue`'s create form (`handleCreate`) only takes name + category; setup notes and rest-timer duration can only be set afterward through their own per-row editors further down the list. Today, adding a new exercise with a rest timer is: add it, scroll down, find it in the list, open two more edit forms. Fix: extend the create form with the same setup-notes/rest-timer inputs the edit forms already use, and pass them through `createExercise` in `src/stores/exercises.ts` (currently only inserts `name`/`category`). Per-row editors stay for later changes — this only removes the forced immediate round-trip after creating. If item 24 lands first, build this into whatever the create form looks like by then; ordering between the two isn't load-bearing.

### 25. Archiving an exercise doesn't remove it from templates it's already attached to `[Effort: 3, Value: 3, ROI: 1]`

Found 2026-09-25 while reviewing the archive flow. `archiveExercise` (`src/stores/exercises.ts`) only flips `exercises.is_archived`; it never touches `workout_template_exercises`, and nothing reading template exercises (`templates.exercisesByTemplate`, consumed by `TemplateManager.vue`'s exercise list and `WorkoutLogger.vue`'s suggested chips/`availableExercises` for a templated workout) filters on the joined exercise's `is_archived`. Net effect: archiving correctly hides an exercise from the create-exercise flow, the freeform workout picker, and new template-exercise-add dropdowns — but if it's already attached to a template, it keeps appearing as a suggested chip and a loggable option every time that template is used, with no indication anywhere that it's archived. Fix direction: filter the template-exercise read path (or its consumers) by `exercise.is_archived`, so an archived exercise stops surfacing for future workouts against templates it's still attached to (past logged sets are unaffected either way — they read the set's own `exercise_id`, not this list). Separately worth deciding: should archiving warn first when the exercise is attached to at least one active template ("used in Leg Day — archiving removes it from future workouts there")? Leaning yes, but that's better folded into whatever confirm-step UI item 24 builds for delete than shipped as a standalone alert here.

### 28. In-app rest timer screen: animated bunny, cooldown progress bar, skip option `[Effort: 5, Value: 5, ROI: 1]`

Reported 2026-09-24. Item 15 shipped rest timers as a push-notification-only affair — when a set logs for an exercise with `rest_seconds` set, the only feedback is a browser/OS notification once the rest elapses; nothing shows on screen while it's counting down. Add a dedicated rest screen: shown right after a set logs for an exercise with a configured `rest_seconds`, it displays the resting-bunny mascot art (user supplied source images this session; a cropped/transparent version needs to land under `public/` or `src/assets/`), a countdown, and a progress bar draining over the rest duration, plus a "Skip Rest" button that dismisses it immediately. The bunny should read as breathing — a slow (~4s), few-pixel scale/translateY loop, not a static image — subtle enough not to look janky on a phone screen mid-workout. Copy pass: lead with a short encouraging line ("Nice work — take a breather") above the countdown, per the approved design. Design mockup (phone-sized, dark theme matching `src/style.css`'s Harvest Hare tokens, interactive Skip button): `https://claude.ai/artifact/5GzCT8Wb78Uzn4skZ8atAn` (private — share it before pointing anyone else at the link). Decide on interaction with the existing push notification (item 15) — likely: keep the push as the backlog/backgrounded-tab fallback, but skip firing it (or let the in-app screen supersede it) whenever the tab is foregrounded and the new screen is already showing, so the user doesn't get both.

### 29. Rotating words-of-encouragement copy on the rest timer screen `[Effort: 2, Value: 2, ROI: 1]`

Spitballed 2026-09-24 alongside item 28, deliberately split out so the core rest-screen build (item 28) doesn't grow scope creep from a copy-rotation system. Instead of one fixed line ("Nice work — take a breather"), cycle through a small hand-written set of encouraging phrases ("Take a load off. You've earned it.", "Keep it up.", etc.) — picked randomly or rotated per rest, on the same headline slot item 28's screen already has. Depends on item 28 shipping first (same screen, same headline element).

### 24. Redesign exercise row actions into pencil/trash icons instead of four text buttons `[Effort: 5, Value: 3, ROI: 0.6]`

Reported 2026-09-25. Each row in `ExerciseList.vue` currently exposes four separate ghost buttons ("Edit name", "Edit notes"/"Add notes", "Edit rest timer"/"Add rest timer", "Archive"), each opening its own inline form — wordy today, and it only grows with item 22. User's preferred direction (over an ellipsis-triggered dropdown, which was also considered): two icon affordances on the right of the row — a pencil that opens one consolidated edit flyout covering name, category, setup notes, and rest timer together, and a trash-can (or X) that requires an explicit confirm step before removing the exercise.

Depends on the archive-vs-delete decision below (**[human]**) — what the trash icon actually does and what its confirmation copy says both hinge on that call; don't build this until it's settled. Touches `e2e/exercise-edit-name.spec.ts`, `e2e/exercise-notes.spec.ts`, `e2e/rest-timer.spec.ts`, and any other spec locating today's text-labeled buttons — icon buttons will need `aria-label`s for those to target instead.

## Human setup / device verification

- [ ] **[human]** Interactive "fresh account" test login (2026-09-24, from backlog item 26's discussion): create a second Supabase auth user for `dephillips1977+test@gmail.com` (Authentication → Users → Add user, Auto Confirm — Gmail's plus-addressing delivers to the same inbox, no new account needed on the phone; Supabase treats it as a fully separate auth identity). Sign into it once via magic link in an incognito window or a separate Chrome profile, then register a passkey there — after that it's one-tap sign-in, isolated from both real accounts by RLS, with nothing to purge to reset to a "brand-new user" view. This is distinct from `TEST_ACCOUNT_EMAIL` (`docs/architecture.md#testing--automation`), which is scripted/Playwright-only — this one's for poking at the real UI by hand.
- [ ] **[human]** Backlog item 15 (per-exercise rest timer with push notification): confirmed working end-to-end on Android, unlocked, including sound (2026-09-24 — the one apparent "no sound" case was the phone's Bluetooth being connected to a car, not a code issue). Still open:
  - [ ] Locked-phone delivery: lock the screen before the rest timer elapses and confirm the notification still arrives.
  - [ ] iPhone verification: same flow, on the iPhone user's device.
  - [ ] Revoke the temporary Supabase personal access token used for the CLI deploy (dashboard → Access Tokens) now that it's no longer needed.
- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** *(optional, cosmetic)* WebAuthn Relying Party Display Name in the Supabase dashboard (Authentication → Passkeys) still reads "Workout Tracker" from before the REP rebrand — some browsers surface this string in the passkey UI. Update it there if you want it to match; it's a dashboard setting, not something in the repo.
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Future discussion:* what is the `exercises.category` field actually for? It's currently just a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing in the app filters, groups, or otherwise behaves differently based on it. Needs a decision: define a real purpose for it (e.g. filtering the exercise picker, grouping template exercises) or drop the field if it's not earning its keep.
- [ ] **[human]** *Blocks item 24:* "Archive" on an exercise (`ExerciseList.vue`'s "Archive" button, `exercises.is_archived`) has no restore path anywhere in the UI — no archived-exercises view, no "unarchive" action. From the user's perspective it already behaves exactly like a permanent delete; the "archive" label just implies a recoverability that doesn't exist. Needs a decision between: (a) build real restore (an archived-exercises list + unarchive action), or (b) keep today's soft-delete mechanism as-is at the DB level — it's what lets an exercise be removed without breaking the FK reference from existing `sets`/`workout_template_exercises` rows, since neither has an `ON DELETE` clause and a real hard delete would fail outright while any history references it — but relabel/reframe the UI as "Delete" with a confirmation step, dropping the "archive" pretense. (b) is the cheaper option and matches what the user described wanting ("if there's not a way to restore, we should just treat it as delete").

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
