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
| 16 | Fix exercise row action buttons overflowing on mobile | 2 | 5 | 2.5 |
| 17 | Collapse "enable rest timer alerts" card once already enabled | 1 | 2 | 2.0 |

## Features

### 17. Collapse "enable rest timer alerts" card once already enabled `[Effort: 1, Value: 2, ROI: 2.0]`

Found 2026-09-24 device-testing backlog item 15: once notifications are enabled on a
device, `ExerciseList.vue`'s "Rest timer alerts" card still shows the full heading +
description (just swaps the button for "Alerts are enabled on this device."), wasting
space above the exercise list on every visit. Either shrink the whole card down to a
one-line confirmation once `push.subscribed` is true, or drop it entirely — user doesn't
care which, just wants the real estate back. No need for a way to re-disable from the UI;
clearing site data/revoking the OS-level permission is enough of an escape hatch for a
two-user prototype.

### 16. Fix exercise row action buttons overflowing on mobile `[Effort: 2, Value: 5, ROI: 2.5]`

Found 2026-09-24 testing backlog item 15 on a real Android phone: `ExerciseList.vue`'s
`.row-actions` button group (Edit name / Edit notes / Add rest timer / Archive) no longer
fits on one line at phone width now that there are four buttons instead of three (item 15
added "Add/Edit rest timer"). The row doesn't wrap them, so it overflows the card and the
rightmost button(s) (Archive) get clipped off-screen instead of wrapping to a second line
or the row growing taller. Screenshot on file from the reporting session showed "Archi..."
cut off at the container edge on every exercise row.

Likely fix: let `.row-actions` wrap (`flex-wrap: wrap`) and/or stack the title block above
the actions on narrow viewports instead of the current side-by-side `.row` layout — same
`.row`/`.row-actions` pattern is reused in `WorkoutLogger.vue`'s active-set list, so check
whether that needs the same fix once this one's confirmed working.

## Human setup / device verification

- [ ] **[human]** Backlog item 15 (per-exercise rest timer with push notification): deploy steps done — Cloudflare env var set, Edge Function deployed (including a 2026-09-24 CORS fix, deployed via `supabase functions deploy` using a temporary personal access token), secrets set. Still open:
  - [ ] Device-verification pass: confirm actual delivery on an unlocked phone first, then locked-and-relocked, on both Android and iPhone. See `docs/architecture.md#push-notifications`.
  - [ ] Revoke the temporary Supabase personal access token used for the CLI deploy (dashboard → Access Tokens) now that it's no longer needed.
- [ ] **[human]** Hostile-read RLS test: now that both accounts have signed in at least once, sign in as one user and attempt to read/write the other's rows by ID directly against the REST API. Confirm both fail. (`docs/architecture.md#row-level-security`)
- [ ] **[human]** Android, installed PWA: retry install now that manifest icons are fixed (they previously 404'd, silently failing Chrome's installability check). If the `⋮` menu still doesn't offer a real "Install app" option, get a screenshot for diagnosis.
- [ ] **[human]** iPhone verification (secondary): confirm iCloud Keychain sync is enabled; test passkey registration inside the installed home-screen PWA (not just a Safari tab); confirm the "Add to Home Screen" flow and app icon.
- [ ] **[human]** App display name, theme color, and final icon (or approve the current placeholder set).
- [ ] **[human]** Custom domain vs. default `*.pages.dev` subdomain.
- [ ] **[human]** *(optional, only if needed)* Resend account, if Supabase's built-in magic-link email hits rate limits.
- [ ] **[human]** *Future discussion:* what is the `exercises.category` field actually for? It's currently just a free-text label (push/pull/legs/cardio suggested via a datalist) set at creation and shown under the exercise's name — nothing in the app filters, groups, or otherwise behaves differently based on it. Needs a decision: define a real purpose for it (e.g. filtering the exercise picker, grouping template exercises) or drop the field if it's not earning its keep.

---

Completed items live in `docs/backlog-archive.md` — not part of the "read before making changes" set; open it only if you need history on something already shipped.
