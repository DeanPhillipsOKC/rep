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
| 20 | Bug: set-entry fields usable (and get silently wiped) before an exercise is picked | 2 | 3 | 1.5 |

## Features

### 20. Bug: set-entry fields usable (and get silently wiped) before an exercise is picked `[Effort: 2, Value: 3, ROI: 1.5]`

Reported 2026-09-24. In `WorkoutLogger.vue`'s set-entry form, Reps/Weight/Unit/RPE are enabled and typeable even with no exercise selected yet. Two bad things follow from that:

- Submitting with no exercise selected relies on the `<select required>`'s native browser validation, which reads as the form "yelling at you" after you've already filled in reps/weight — not before.
- Picking an exercise *after* typing reps/weight silently blows the typed values away: `watch(exerciseId, ...)` unconditionally calls `applyPrefill(id)`, which sets `reps.value`/`weight.value` to either the previous-workout prefill or `null` — with no check for whether the user already had something in those fields.

Fix direction (user's preference): don't let the problem happen at all — hide or disable the Reps/Weight/Unit/RPE inputs and the "Add set" button until `exerciseId` is set, rather than validating/correcting after the fact. Hiding is probably the better of the two (a disabled-but-visible numeric input inviting a tap is its own small papercut), but either satisfies the report. Touches only `WorkoutLogger.vue`'s template/script — no store or schema changes. Check whether any `e2e/*.spec.ts` specs assume those fields are visible before an exercise chip/option is clicked.

## Human setup / device verification

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

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
