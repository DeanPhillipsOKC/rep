# Setup checklist

Things a human needs to do to get this prototype running — mostly account creation and
device-level verification that no agent can do on your behalf. Check items off as you go.
Anything not listed here (writing schema, config files, app code) is Claude's/Codex's job.

## Accounts to create

- [x] **GitHub** — repo: https://github.com/DeanPhillipsOKC/rep
- [x] **Supabase** ([supabase.com](https://supabase.com)) — project created (`zdcoqykpuhyftuqtyngt`). URL + publishable key are in `.env.local` (gitignored, not committed).
- [x] **Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)) — account created, Pages project connected to the GitHub repo.
  - [ ] In the Cloudflare Pages project settings, set **build command** `npm run build`, **build output directory** `dist`.
  - [ ] Add environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`) in Pages → Settings → Environment variables, so the deployed build can reach Supabase.
- [ ] *(Optional, only if Supabase's built-in email hits rate limits)* **Resend** free tier, for magic-link/recovery email.
- [ ] *(Optional)* A domain name, if you want something other than the default `*.pages.dev` subdomain.

## Local machine

- [x] **Node.js (LTS)** installed.
- [x] `npm install` run, `npm run build` verified working.

## Supabase project configuration (dashboard, after project creation)

- [x] Disable open sign-ups in Auth settings (invite-only app — see `docs/architecture.md#access-control`).
- [x] Run `supabase/schema.sql` and `supabase/policies.sql` in the SQL editor to create tables and RLS policies. Verified via anon-key REST calls: reads return empty, unauthenticated writes get rejected with `42501`.
- [x] Run `supabase/seed.local.sql` to seed the `allowed_users` table.
- [x] Checked current WebAuthn/passkey support — public beta as of May 2026, still "experimental, API may change without notice." Decision: proceed with passkeys anyway (see `docs/architecture.md#authentication`).
- [ ] **Configure Relying Party settings** for passkeys: Authentication → Passkeys (BETA) in the dashboard. Set:
  - RP Display Name: `Workout Tracker`
  - RP ID: `rep-970.pages.dev` (or your custom domain, if/when you set one up — passkeys registered under one RP ID won't carry over to another)
  - RP Origins: `https://rep-970.pages.dev`
  Passkey registration will fail until this is set.
- [ ] **URL Configuration** (Authentication → URL Configuration): set **Site URL** to `https://rep-970.pages.dev`, and add both `https://rep-970.pages.dev` and `http://localhost:5173` under **Redirect URLs** — magic-link sign-in will fail with a redirect error otherwise (the second one only matters if you test with `npm run dev` locally).
- [ ] Once real accounts exist: sign in as user A and try to read/write user B's rows by ID directly against the REST API. Confirm both fail — this is the full hostile-read test from `docs/architecture.md#row-level-security`, which couldn't be run earlier with no real users.

## Decisions only you can make

- [x] Allowed users: dephillips1977@gmail.com (owner, Android), christashouse@hotmail.com (invited, iPhone).
- [x] Platform priority: build and test on Android first; iPhone-specific behavior gets verified once available.
- [ ] App display name, theme color, and icon (or approve a generated default).
- [ ] Custom domain vs. default `*.pages.dev` subdomain.

## Physical device verification

- [ ] **Android** (primary): confirm the app installs from Chrome, the `beforeinstallprompt` install flow works, and passkey registration works inside the installed PWA.
- [ ] **iPhone** (secondary, once available): confirm iCloud Keychain sync is enabled; test passkey registration *inside the installed home-screen PWA*, not just in a Safari tab — behavior has historically differed between the two; confirm the "Add to Home Screen" flow and app icon look right.

## Not needed for this project

Apple Developer account, a Mac, App Store Connect — the architecture explicitly avoids any native build path.
