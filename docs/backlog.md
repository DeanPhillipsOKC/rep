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

1. Item 40 — Brand system refresh: palette, type, and bunny mark tokens [ROI 2.6]
2. Item 39 — Rebrand REP to RepBunny (name + mark) [ROI 1.7]
3. Item 42 — First-launch onboarding screen [ROI 1.7]
4. Item 43 — Redesigned sign-in screen (passkey-first) [ROI 1.7]
5. Item 44 — Home screen visual refresh [ROI 1.7]
6. Item 41 — Bottom tab bar navigation (replaces hamburger drawer) [ROI 1.6]
7. Item 45 — History screen visual refresh [ROI 1.5]
8. Item 46 — Templates screen visual refresh [ROI 1.5]
9. Item 47 — Exercises screen visual refresh [ROI 1.5]

## Features

Design source for items 39–47: private canvas mockup at
https://claude.ai/artifact/365JapPyt535xKDe7roJaQ (artboard names referenced below match its
canvas). Renaming REP → RepBunny throughout — brand identity is cute, functional, cool.

- [ ] **Brand system refresh: palette, type, and bunny mark tokens** (item 40): update `src/style.css`'s `:root` tokens to the RepBunny palette (Bunny Pink accent, Sprout green for PR states, Lavender/Carrot Gold as sparing secondary accents, refined night/warren background tones) and load Baloo 2 (display) + Manrope (body/UI) from Google Fonts in place of the current type stack. Foundational — every other item below builds on these tokens. See the "Style" artboard for exact hex values and specimens. [Effort: 5, Value: 13, ROI: 2.6]
- [ ] **Rebrand REP to RepBunny (name + mark)** (item 39): rename the app throughout — PWA manifest `name`/`short_name`, `document.title`/`<title>`, the in-app header wordmark, and the doc titles (`README.md`/`AGENTS.md`/`CLAUDE.md`/`docs/architecture.md`) touched by the original REP rebrand. Swap the PWA icon set (`public/icon-192.png`, `icon-512.png`, `apple-touch-icon.png`, favicons, notification badge) for a new bunny mark — user has supplied bunny illustration source art to work from (already used on the Onboarding artboard). See the "Style" artboard for the wordmark/lockup treatment. [Effort: 3, Value: 5, ROI: 1.7]
- [ ] **First-launch onboarding screen** (item 42): add a welcome screen shown once before sign-in (mascot, "RepBunny" wordmark, tagline, single "Let's hop in" CTA into the sign-in screen) — the app currently opens straight into the login form with no first impression. Needs a local "has seen onboarding" flag (e.g. localStorage) so it doesn't reappear every launch. See the "Onboarding" artboard. Depends on items 39 and 40. [Effort: 3, Value: 5, ROI: 1.7]
- [ ] **Redesigned sign-in screen (passkey-first)** (item 43): rework `LoginForm.vue` to lead with "Sign in with passkey" as the primary CTA — matching the actual auth model (no signup, two allowlisted users, passkey-first per `docs/architecture.md#authentication`) — and demote the email/magic-link path to a secondary fallback below a divider, instead of today's flat form. Purely a front-end restructure; calls the same `registerPasskey`/`signInWithPasskey`/magic-link paths already in place. See the "Auth" artboard. Depends on item 40. [Effort: 3, Value: 5, ROI: 1.7]
- [ ] **Home screen visual refresh** (item 44): restyle the Log/Home screen's existing progress strip (item 19, archived) and template picker — swap the plain "workouts this week" number for a paw-print week tracker, give the PR tile a more celebratory treatment, and turn the template `<select>` into quick-pick chips above the existing form. No new data, same underlying state, restyled. See the "Home" artboard. Depends on item 40. [Effort: 3, Value: 5, ROI: 1.7]
- [ ] **Bottom tab bar navigation** (item 41): replace `AppMenu.vue`'s hamburger drawer (item 18, archived) with a persistent bottom tab bar (Home / History / Templates / Exercises) so primary destinations are always one tap away instead of hidden behind a menu; frees the header for a lighter secondary action. Requires reworking `e2e/fixtures/nav.ts`'s `goTo` helper and every spec that uses it. See the bottom nav on every phone artboard. Depends on item 40 (active-tab color tokens). [Effort: 5, Value: 8, ROI: 1.6]
- [ ] **History screen visual refresh** (item 45): add a timeline rail (connecting line + dot per entry, a distinct marker on days with a PR) to the workout history list, and visually condense entries beyond the most recent couple so the list doesn't read as a wall of identical cards. See the "History" artboard. Depends on item 40. [Effort: 2, Value: 3, ROI: 1.5]
- [ ] **Templates screen visual refresh** (item 46): give each template card an icon and accent tint (visually distinguishing templates from each other) and show its exercise count as subtext, in place of today's plain name + Archive row. See the "Templates" artboard. Depends on item 40. [Effort: 2, Value: 3, ROI: 1.5]
- [ ] **Exercises screen visual refresh** (item 47): restyle the "Rest timer alerts are enabled" notice as a pill/banner instead of plain text, and show start-position/rest-timer values as tag pills on each row instead of grey caption text. See the "Exercises" artboard. Depends on item 40. [Effort: 2, Value: 3, ROI: 1.5]

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
