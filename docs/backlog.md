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
| 15 | Per-exercise rest timer with notification | 8 | 8 | 1.0 |

## Features

### 15. Per-exercise rest timer with notification `[Effort: 8, Value: 8, ROI: 1.0]`

Configure a rest duration per exercise; after logging a set, count down and notify the user when rest is over so they don't have to watch a clock between sets. Primary motivating case is the iPhone user (owner is Android) — real durations both users actually want are in the 30–90s range (owner prefers 90s, the iPhone user prefers 30s).

**Design decision (researched — don't relitigate):** a plain `setTimeout` + local Notification only reliably fires while the PWA's own process is alive, which iOS aggressively suspends the moment the app leaves the foreground (including just locking the screen) — Android is more lenient but not guaranteed either. Reliably notifying through a locked phone requires real Web Push, dispatched server-side independent of whatever the client is doing. This needs no Mac or Apple Developer account — iOS Safari 16.4+ implements the same standard Web Push (VAPID) protocol as Chrome/Firefox, just gated behind the PWA being added to the home screen first.

Shape:

- **Schema:** nullable `rest_seconds` column on `exercises` (same shape as `setup_notes`, item 8), editable inline in `ExerciseList.vue`. Per-user isolation already falls out of `exercises` being a per-user table — no extra design needed for the two of them wanting different durations on their own copy of an exercise.
- **Subscribe flow:** a new `push_subscriptions` table (RLS-scoped like everything else) storing each installed device's `PushSubscription` (endpoint + keys). Client subscribes via `serviceWorkerRegistration.pushManager.subscribe()` with a VAPID public key, behind a deliberate "Enable rest timer alerts" button — iOS requires the PWA be installed to the home screen first and won't allow prompting for permission on load, only from a user gesture inside the installed app.
- **Service worker:** gains a `push` handler (`self.registration.showNotification(...)`) and a `notificationclick` handler to focus the app.
- **Dispatch:** on logging a set for an exercise with a configured `rest_seconds`, the client makes one call (while still active) to a Supabase Edge Function with the subscription + delay. Given the confirmed 30–90s real-world range, the function can just `await sleep(rest_seconds)` then send the push directly via the `web-push` library (Deno-compatible) and VAPID private key (an Edge Function secret, never client-exposed, same handling as the service role key) — no `pg_cron`/polling needed, since that range comfortably fits under typical Edge Function execution limits (verify the current limit at build time, per the free-tier-limits-change note in `docs/architecture.md#operational-notes`).
- Needs a **[human]** device-verification pass once built (notification permission prompt + actual delivery, both a locked-and-relocked iPhone and Android) — add that as a checklist item below when this ships.

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
