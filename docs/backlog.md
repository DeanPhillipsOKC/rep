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
| 15 | Per-exercise rest timer with notification | 5 | 5 | 1.0 |

## Features

### 15. Per-exercise rest timer with notification `[Effort: 5, Value: 5, ROI: 1.0]`

Configure a rest duration per exercise; after logging a set, count down and notify the user when rest is over so they don't have to watch a clock between sets.

- Add a configurable rest duration (seconds, nullable) per exercise — same shape as `setup_notes` (item 8): a column on `exercises`, editable inline in `ExerciseList.vue`.
- After logging a set for an exercise with a configured duration, `WorkoutLogger.vue` starts a visible countdown; on completion, notify via the Notification API (`Notification` / `registration.showNotification()`), with `navigator.vibrate` as a companion/fallback. Request notification permission once, same UX shape as the existing passkey prompt.
- **Feasibility decision (researched — don't relitigate):** a PWA can reliably fire a local notification on timer completion only while its own process is still alive — realistic for the gym use case (phone nearby, tab open, screen may briefly dim). It is **not** reliable if the phone is locked/backgrounded for the *entire* rest period, especially on iOS, without real Web Push infrastructure (VAPID keys, a subscription store, and something server-side to trigger the push at the right moment) — which conflicts with this project's zero-recurring-cost / small-surface-area constraints (`docs/architecture.md#guiding-constraints`). Build the foreground-reliable version; treat "notifies even through a full phone lock" as an explicit non-goal unless the user later wants to invest in that infrastructure.
- Needs a **[human]** device-verification pass once built (notification permission prompt + actual delivery) on both the Android and iPhone installed PWA — add that as a checklist item below when this ships.

## Human setup / device verification

- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** Android, installed PWA: retry install now that manifest icons are fixed (they previously 404'd, silently failing Chrome's installability check). If the `⋮` menu still doesn't offer a real "Install app" option, get a screenshot for diagnosis.
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** App display name, theme color, and final icon (or approve the current placeholder set).
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Future discussion:* what is the `exercises.category` field actually for? It's currently just a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing in the app filters, groups, or otherwise behaves differently based on it. Needs a decision: define a real purpose for it (e.g. filtering the exercise picker, grouping template exercises) or drop the field if it's not earning its keep.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
