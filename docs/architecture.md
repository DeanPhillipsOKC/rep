# RepBunny (Workout Tracker PWA) — Architecture

> Canonical technical reference for this project. Source brief: `ARCHITECTURE.pdf` in this folder.
> Update this file, not the PDF, as decisions evolve.

## Purpose

A private, installable workout tracker for two users (owner + one invited user). Installs to the home screen on both Android (Chrome) and iPhone (Safari). No App Store, no Mac, no recurring cost.

> Note: the original brief assumed iPhone-only. Actual usage is cross-platform — owner is on Android, the invited user is on iPhone. Android is the primary development/testing target; iPhone-specific behavior (see PWA configuration and Authentication below) gets verified second, opportunistically. Treat anything below marked "iOS" as applying only to the iPhone user, not as the default target.

## Guiding constraints

1. **Zero recurring cost.** Everything must sit inside a free tier that does not require a card to start.
2. **Secure by default.** Auth is passkey-first. Data is isolated per user at the database level, not just in application code.
3. **Small surface area.** Two users. Do not build for scale that will never arrive.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Vue 3 + TypeScript (Composition API, `<script setup>`) | Matches existing skill set; Vue 3 for current tooling and better TS inference |
| Build | Vite + `vite-plugin-pwa` | Generates manifest and service worker; sane defaults for offline shell |
| State | Pinia | Minimal, TS-native |
| Routing | Vue Router (`src/router.ts`) | Real paths per screen (`/`, `/history`, `/templates`, `/exercises`) push real browser history entries, so back/forward — and the swipe-back gesture that drives it on mobile — navigates in-app instead of exiting; a plain `view` ref (pre-2026-09-25) never touched history at all |
| Backend | Supabase (Postgres + Auth + RLS) | Auth, database, and row-level authorization in one free tier |
| Hosting | Cloudflare Pages | Free static hosting, custom domain optional, no cold starts |
| Email (fallback only) | Supabase built-in, or Resend free tier if rate limits bite | Only used for account recovery |

**Explicitly not using:** React Native, Expo, Capacitor, any native build path. No Apple Developer account. No server-side rendering. No custom Node backend.

## Authentication

### Model

Passkey-first (WebAuthn), with magic link retained as a recovery path only.

**Enrollment flow:**

1. User signs in once via magic link to establish the account.
2. Immediately prompt to register a passkey.
3. Subsequent sign-ins use the passkey (Face ID on iPhone, one tap).

Magic link is never the primary path after enrollment. It exists so a lost credential does not mean a lost account.

### Requirements

- Verify Supabase's current WebAuthn support before building. It is a newer feature and the API may have changed. If it is not production-ready at implementation time, fall back to magic-link-only auth and layer passkeys in later. Do not hand-roll a WebAuthn implementation.

> **Status as of 2026-09-22:** Supabase's Passkeys support went to public beta in May 2026 (`@supabase/supabase-js` v2.105.0+, client opt-in via `auth: { experimental: { passkey: true } }`) but Supabase still documents it as experimental with "the API may change without notice." Per the fallback rule above, the safe default would be magic-link-only for now. **Decision: build passkey-first anyway**, accepting the risk of a breaking API change later — this is a two-user prototype, the blast radius of a breaking change is low, and re-doing the auth UI later is cheap. If Supabase ships a breaking change, expect to revisit `src/stores/auth.ts` and `src/components/*`.

- Do not hand-roll a WebAuthn implementation — use `supabase.auth.registerPasskey()` / `supabase.auth.signInWithPasskey()` / `supabase.auth.passkey.list()`.
- Configure Relying Party settings in the Supabase dashboard (Authentication → Passkeys) before passkey registration will work: RP Display Name, RP ID (bare domain, e.g. `rep-970.pages.dev`), RP Origins (matching HTTPS origin(s), up to 5). See `docs/backlog.md`.
- Register at least two passkeys per account where possible. On Android this syncs via Google Password Manager; on iPhone, confirm iCloud Keychain sync is enabled — so credentials survive device loss either way.
- Test passkey registration inside the installed home-screen PWA context on each platform, not only in a browser tab. Behavior has historically differed between installed and tab contexts, especially on iOS Safari.
- Set a long session expiry. Safari in particular can evict storage during idle periods, which forces re-auth.

### Access control

The app is invite-only. There is no public sign-up.

- Disable open sign-ups in the Supabase Auth settings.
- Maintain an allowlist by seeding the two user rows manually (Authentication → Users → Add user, with Auto Confirm), rather than building an `allowed_users` table the app would have to check on every sign-in attempt. With signups disabled, an unrecognized email simply can't create an account — there's nothing left for a table-based check to add for two users.
- Do not rely on "nobody knows the URL" as a control.

### Testing / automation

Real auth is passkey + magic-link only — neither is scriptable, which blocks browser
automation and end-to-end tests. `scripts/create-test-session.mjs` (`npm run test:session`)
mints a real session for a dedicated test account instead of a client-visible bypass:

1. Uses the Supabase **service role** key (Admin API) to call `auth.admin.generateLink({ type: 'magiclink', email })` for the test account. This both creates the account if it doesn't exist yet and returns a `hashed_token`, bypassing the "disable signups" restriction the same way the dashboard's manual account creation does.
2. Redeems that token with the **anon** key via `auth.verifyOtp({ token_hash, type: 'email' })` — the same call flow a user clicking the magic-link email would trigger — to get a real `Session` (access + refresh tokens).
3. Prints the session plus the `sb-<project-ref>-auth-token` localStorage key a browser automation tool should inject it under, so the app's normal `supabase.auth.getSession()` picks it up on load with no code path specific to testing.

The minting logic lives in `scripts/lib/mint-test-session.mjs` so both the CLI script and Playwright can call it directly (see `e2e/fixtures/auth.ts` below) without shelling out.

Constraints:

- The service role key lives in `.env.local` only (`SUPABASE_SERVICE_ROLE_KEY`) — never committed, never in Cloudflare Pages env vars. Same handling as any other service-role use (see Client security below).
- `TEST_ACCOUNT_EMAIL` must be a dedicated test account, never one of the two real allowlisted users — the script refuses to run against either.
- Verify `generateLink`/`verifyOtp` still behave this way against the installed `@supabase/supabase-js` version before depending on this further; confirmed working as of `@supabase/supabase-js` 2.117.0.

### End-to-end tests (Playwright)

`e2e/` holds Playwright specs (`npm run test:e2e`). `playwright.config.ts` boots the Vite
dev server automatically (`webServer`, reused if already running locally) and runs against
Chromium. `e2e/fixtures/auth.ts` wraps the test-session mint above into `signInAsTestUser(page)`
so specs can start already signed in — confirmed working end-to-end (`e2e/auth.spec.ts`).

**This is the required way to verify UI changes in this repo.** The Claude-in-Chrome
browser extension has been unreliable in this environment (extension not connected) —
don't rely on it or treat a failed connection as a blocker. Instead, write or extend a
Playwright spec under `e2e/` covering the change and run `npm run test:e2e`. Every new
feature that touches the UI should land with (or exercise) an e2e spec rather than being
declared done on typecheck/build passing alone.

### Commit & push policy

**Standing rule:** once a change is verified — `npm run build` (typecheck) passes and the
full `npm run test:e2e` regression suite is green, including any spec added/extended for
the change — commit it and push to `main` automatically, without stopping to ask first.
This repo has no CI/PR gate (two-user prototype, direct-to-main history), and Cloudflare
Pages auto-deploys `main` on push, so a verified commit is safe to ship immediately.

Still stop and ask before:

- Force-pushing, rewriting history, or anything else destructive (see the general git
  safety rules — those are not overridden by this policy).
- Pushing a change that couldn't be run through `npm run test:e2e` (no UI surface, dev
  server/Playwright unavailable, etc.) — commit locally and flag why it wasn't pushed
  instead of pushing unverified.
- A change the user asked to review before it ships.

## Data model

Keep it narrow. Resist adding tables until a real need appears.

```
profiles
  id            uuid  PK, references auth.users(id)
  display_name  text
  created_at    timestamptz

exercises
  id            uuid  PK
  user_id       uuid  FK -> profiles(id)
  name          text
  is_archived   boolean default false
  setup_notes   text null       -- machine seat height, incline position, etc.
  rest_seconds  int null        -- per-exercise rest timer duration; null = no alert

push_subscriptions
  id          uuid  PK
  user_id     uuid  FK -> profiles(id)
  endpoint    text  unique      -- Push API endpoint URL, globally unique per device
  p256dh      text              -- PushSubscription.keys.p256dh
  auth        text              -- PushSubscription.keys.auth
  created_at  timestamptz

workouts
  id            uuid  PK
  user_id       uuid  FK -> profiles(id)
  performed_at  timestamptz
  notes         text

sets
  id            uuid  PK
  workout_id    uuid  FK -> workouts(id) on delete cascade
  exercise_id   uuid  FK -> exercises(id)
  set_index     int             -- ordering within the workout
  reps          int
  weight        numeric
  weight_unit   text            -- 'lb' | 'kg'
  rpe           numeric null
```

Notes:

- `weight_unit` is stored per set rather than as a global setting. Cheap now, avoids a migration later.
- `exercises` is per-user rather than a shared global catalog. Two users, no benefit to sharing, and it keeps RLS uniform.
- Soft-delete exercises via `is_archived` so historical sets keep resolving to a name.
- `push_subscriptions` has no `is_archived`/soft-delete — a dead subscription (uninstalled app, revoked permission) just fails to deliver a push; nothing reads this table for anything else, so there's no history to preserve.

## Row-level security

This is the actual security boundary. Application code is not.

Enable RLS on every table. No exceptions, including tables that seem harmless.

```sql
alter table profiles          enable row level security;
alter table exercises         enable row level security;
alter table workouts          enable row level security;
alter table sets              enable row level security;
alter table push_subscriptions enable row level security;
```

Policy shape for directly-owned tables:

```sql
create policy "own rows only" on exercises
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

`sets` has no `user_id` of its own, so it inherits ownership through its workout:

```sql
create policy "own sets only" on sets
  for all
  using (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from workouts w
      where w.id = sets.workout_id
        and w.user_id = auth.uid()
    )
  );
```

**Verification step, not optional:** after writing policies, sign in as user A and attempt to read and write user B's rows by ID directly against the API. Confirm both fail. A policy that was never tested against a hostile read is a policy you do not know works.

See `supabase/schema.sql` and `supabase/policies.sql` for the runnable versions of the above.

## Client security

- Only the Supabase **anon** key ships to the browser. The service role key must never appear in client code, environment files committed to the repo, or the build output. It bypasses RLS entirely.
- Put secrets in Cloudflare Pages environment variables, not in the repo.
- Set a Content Security Policy. Restrict `connect-src` to the Supabase project URL and `self`.
- Enforce HTTPS. Cloudflare Pages does this by default; do not disable it.
- Validate input on write. RLS controls *who* can write, not *what* they can write. Add Postgres check constraints for sane ranges (`reps > 0`, `weight >= 0`).

## PWA configuration

- `display: standalone`, portrait orientation, dark theme color.
- Provide a maskable icon (Android adaptive icon shape) in addition to the plain square icons — Android Chrome's install/home-screen rendering wants one.
- Provide the full iOS icon set including `apple-touch-icon`. iOS ignores parts of the web manifest and needs its own meta tags. (iPhone-only concern.)
- Service worker caches the app shell for offline load. Workout logging in a gym with poor signal is the common case, so the shell must load without network.
- The service worker is hand-written (`src/sw.ts`, built via `vite-plugin-pwa`'s `injectManifest` strategy, not the default `generateSW`) because rest timer alerts (below) need a custom `push`/`notificationclick` handler that `generateSW` has no hook for. `injectManifest` still auto-generates and injects the precache list (`self.__WB_MANIFEST`) — the app-shell caching behavior is unchanged, just declared in hand-written code instead of config.
- Vue Router (above) gave the app real paths per screen, so the shell has to load offline at any of them, not just `/` — `sw.ts` registers a `workbox-routing` `NavigationRoute` that serves the precached `index.html` for every same-origin navigation request. `public/_redirects` (`/* /index.html 200`) does the equivalent for Cloudflare Pages when there's a network but the platform would otherwise 404 a path it doesn't know about (e.g. a hard reload on `/templates`).
- **Offline writes:** queue mutations in IndexedDB and sync when connectivity returns. This is the single most valuable feature for real gym use. Build it early rather than retrofitting.
- Android Chrome fires `beforeinstallprompt`; use it to show a native-feeling install button instead of an in-app hint.
- iOS gives no install prompt at all. Add a one-time in-app hint explaining the Share → Add to Home Screen flow. (iPhone-only concern.)
- Add a data export (JSON or CSV download). Cheap insurance against storage eviction or a Supabase project pause.

## Push notifications (rest timer alerts)

Backlog item 15. A per-exercise rest timer (`exercises.rest_seconds`) needs to notify the
user when rest is over even if the phone is locked or the PWA isn't in the foreground — a
plain `setTimeout` + local `Notification` doesn't survive that on iOS (aggressively
suspended) and isn't guaranteed on Android either. This uses real Web Push (VAPID),
dispatched server-side independent of the client:

1. **Subscribe:** a deliberate "Enable rest timer alerts" button (`ExerciseList.vue`) calls
   `Notification.requestPermission()` then `serviceWorkerRegistration.pushManager.subscribe()`
   with the VAPID public key (`src/stores/pushSubscription.ts`). Must be a direct user-gesture
   handler — iOS refuses to prompt otherwise, and won't allow this at all until the PWA is
   installed to the home screen. The resulting `PushSubscription` (endpoint + keys) is upserted
   into `push_subscriptions`, keyed on `endpoint` (globally unique per device).
2. **Dispatch:** right after `addSet` succeeds, if the exercise has a `rest_seconds` set,
   `WorkoutLogger.vue` fires an unawaited call to the `rest-timer-notify` Edge Function
   (`supabase/functions/rest-timer-notify/`) with the device's current subscription and the
   delay. The function itself does `await sleep(restSeconds)` then sends the push via the
   `web-push` npm package (imported with Deno's `npm:` specifier — Supabase Edge Functions run
   on Deno) and the VAPID private key. No `pg_cron`/polling: a 30-120s sleep is async wait, not
   CPU time, and comfortably fits the free-tier Edge Function limits (150s wall clock, 2s
   **active** CPU, 256MB memory — confirmed 2026-09-24, re-verify at build time per the
   free-tier-limits-change note below).
3. **Service worker:** `src/sw.ts` (see PWA configuration above) handles `push` by calling
   `self.registration.showNotification(...)` and `notificationclick` by focusing an existing
   app window or opening a new one.
4. **Foreground UI (backlog item 28):** `RestTimer.vue` is a full-screen countdown shown
   in-app while the tab is foregrounded — mascot art, a draining progress bar, and a Skip
   Rest button, driven by a fixed `endsAt` timestamp rather than a plain decrementing timer.
   The push stays as the fallback, but *not* decided once at `addSet` time — logging a set is
   itself done in the foreground, so an add-time-only check on `document.hidden` always picked
   the in-app screen, and backgrounding or locking the phone mid-rest then suspends that
   screen's `setInterval` with no push ever having been sent (found in device testing
   2026-09-24: silence on both counts). Instead, `WorkoutLogger.vue` registers a
   `visibilitychange` listener for as long as a rest period is active
   (`handleRestVisibilityChange`) and sends the push the first time the tab actually goes
   hidden, with however many seconds are actually left at that moment — covering "logged the
   set, then locked the screen" as well as "logged the set already backgrounded." Skipped only
   when the tab never goes hidden during the rest period, since `RestTimer.vue` running to
   completion in the foreground is already a real alert (vibration + on-screen countdown
   hitting zero).

**Secrets, never client-exposed** (Edge Function secrets, same handling as the service role
key — `supabase secrets set NAME=value`): `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`,
`VAPID_SUBJECT` (a `mailto:` contact address, required by the Web Push protocol). The public
half is *also* needed client-side as `VITE_VAPID_PUBLIC_KEY` (safe to ship — it identifies
this app to the push service, it isn't a secret) — set in `.env.local` for dev and Cloudflare
Pages env vars for prod, same as the Supabase URL/anon key.

**Deploying/updating the function:** `supabase functions deploy rest-timer-notify` (default
JWT verification stays on — `supabase.functions.invoke` from the client attaches the signed-in
user's access token, so this can't be reached unauthenticated). No DDL/deploy execution path
is available to an agent working in this repo (same constraint as schema migrations, see
`docs/backlog-archive.md`) — deploying the function and setting its secrets is a human step
via the Supabase CLI or dashboard.

## Operational notes

- **Supabase pauses free projects after roughly a week of inactivity.** Resuming is a dashboard click, but if usage is sporadic this will be the main friction. Consider a scheduled ping if it becomes a nuisance, or accept it.
- Free tier limits change. Verify current allowances at build time rather than trusting this document.
- No analytics, no third-party scripts, no tracking. Two users, private fitness data, nothing to gain from instrumentation.
- **The service worker caches the previous deploy.** After pushing a change, a device that already has the app open/installed can take a moment to pick it up — the browser only checks a service worker script for byte-for-byte changes on navigation, so the first load after a deploy can still be the old one. If a deploy "doesn't seem to have worked," try an incognito/private tab first to rule out stale cache before assuming it's a real bug. A background/foreground of the installed app (or a second navigation) should pick up the update automatically; see the note below for why that wasn't true before 2026-09-24.
- **Service worker auto-update wiring (fixed 2026-09-24).** `injectManifest` (used here so `sw.ts` can hand-add the push handler — see below) doesn't get the `skipWaiting`/`clientsClaim` pair `generateSW` auto-adds for `registerType: 'autoUpdate'`; without them a newly-fetched worker sat in "waiting" until every open tab/window fully closed, which for an installed PWA that's rarely fully quit meant it effectively never updated — the only fix was uninstalling and reinstalling. `sw.ts` now listens for a `SKIP_WAITING` message and calls `clientsClaim()`; `vite.config.ts` sets `injectRegister: false` (the plain auto-injected `registerSW.js` only registers once on load, no update checks); `main.ts` instead imports vite-plugin-pwa's real `virtual:pwa-register` client (`registerSW({ immediate: true })`), which polls for updates, posts `SKIP_WAITING` when one's found, and reloads the page on `controllerchange`.

## Build order

1. Vite + Vue 3 + TS scaffold, deployed to Cloudflare Pages. Confirm the pipeline works before writing features.
2. Supabase project, schema, and RLS policies. Test the isolation attack described above.
3. Auth: magic link first (it is the recovery path regardless), then passkey enrollment on top.
4. Core logging: create workout, add sets, view history.
5. PWA manifest, icons, service worker, install hint.
6. Offline queue and sync.
7. Data export.

Ship after step 4 if it is usable. The remaining steps improve it but are not blockers to real use.

## Open decisions

- Whether exercise history needs charting, or whether a simple list of previous sets per exercise is enough. **Start with the list.**
- Whether the two users should ever see each other's workouts. **Assume no**; RLS above enforces that. Changing it later means new policies, not a schema change.
