# Backlog archive (cold storage)

Completed backlog items and finished setup tasks, condensed to one-liners. Not part of the
"read before making changes" set in `CLAUDE.md`/`AGENTS.md` — open this only if you need history
on something already shipped. New entries get appended here when an item is removed from
`docs/backlog.md`.

## Setup / accounts

- GitHub repo created: https://github.com/DeanPhillipsOKC/rep
- Supabase project created (`zdcoqykpuhyftuqtyngt`); URL + anon key in `.env.local` (gitignored).
- Cloudflare Pages connected to the repo; build command `npm run build`, output `dist`; env vars
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` set and confirmed baked into the deployed bundle.
- Node LTS installed locally; `npm install` / `npm run build` verified.

## Supabase configuration

- `supabase/schema.sql` + `supabase/policies.sql` applied; verified via anon-key REST calls
  (empty reads, `42501` on unauthenticated writes).
- Passkey support confirmed public-beta as of 2026-05; decision made to build passkey-first
  anyway (see `docs/architecture.md#authentication`).
- Relying Party configured: Display Name `Workout Tracker`, RP ID `rep-970.pages.dev`, RP Origins
  `https://rep-970.pages.dev`; confirmed via `/auth/v1/settings`.
- URL Configuration: Site URL `https://rep-970.pages.dev`; redirect URLs include that plus
  `http://localhost:5173`.
- Open sign-ups disabled; confirmed via `/auth/v1/settings` (`disable_signup: true`).
- Both allowed accounts pre-created manually (Auto Confirm), no `allowed_users` table.

## Decisions made

- Allowed users: dephillips1977@gmail.com (owner, Android), christashouse@hotmail.com (invited, iPhone).
- Platform priority: Android first, iPhone verified opportunistically.

## Device verification

- Android, browser tab: magic-link sign-in and passkey registration both worked on
  `rep-970.pages.dev` in Chrome.

## Shipped features

- Core workout logging: create workout, add sets, view history (`8da13e5`).
- `profiles` row auto-created on sign-in to satisfy `exercises`/`workouts` FK (`850742a`).
- Dark, mobile-first styling for auth and logging screens (`714909b`).
- Placeholder PWA icons added (`06a0cd4`).
- Local/automated auth path for testing: `scripts/create-test-session.mjs` (`npm run test:session`) mints a real session for a designated test account via the Supabase Admin API (service-role `generateLink` + anon-key `verifyOtp`), unblocking browser/E2E automation without a client-visible auth bypass. See `docs/architecture.md#testing--automation`.
- Playwright e2e harness added (`e2e/`, `npm run test:e2e`); `e2e/fixtures/auth.ts` reuses the test-session mint to start specs already signed in. Confirmed passing locally against Chromium, including the signed-in-via-injected-session case.
- Workout templates (hierarchy): `workout_templates` + `workout_template_exercises` tables, `workouts.template_id`, matching RLS, a Templates tab to build/reorder named routines, template selection + suggested-exercise chips when starting a workout, and a template tag in History. Verified via `e2e/templates.spec.ts`. Unblocks backlog items 3 and 6.
