# Setup checklist

Things a human needs to do to get this prototype running — mostly account creation and
device-level verification that no agent can do on your behalf. Check items off as you go.
Anything not listed here (writing schema, config files, app code) is Claude's/Codex's job.

## Accounts to create

- [x] **GitHub** — repo: https://github.com/DeanPhillipsOKC/rep
- [x] **Supabase** ([supabase.com](https://supabase.com)) — project created (`zdcoqykpuhyftuqtyngt`). URL + publishable key are in `.env.local` (gitignored, not committed).
- [x] **Cloudflare** ([dash.cloudflare.com](https://dash.cloudflare.com)) — account created, Pages project connected to the GitHub repo.
  - [x] In the Cloudflare Pages project settings, set **build command** `npm run build`, **build output directory** `dist`.
  - [x] Added environment variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Pages → Settings → Environment variables. Confirmed baked into the deployed bundle.
- [ ] *(Optional, only if Supabase's built-in email hits rate limits)* **Resend** free tier, for magic-link/recovery email.
- [ ] *(Optional)* A domain name, if you want something other than the default `*.pages.dev` subdomain.

## Local machine

- [x] **Node.js (LTS)** installed.
- [x] `npm install` run, `npm run build` verified working.

## Supabase project configuration (dashboard, after project creation)

- [x] Run `supabase/schema.sql` and `supabase/policies.sql` in the SQL editor to create tables and RLS policies. Verified via anon-key REST calls: reads return empty, unauthenticated writes get rejected with `42501`.
- [x] Checked current WebAuthn/passkey support — public beta as of May 2026, still "experimental, API may change without notice." Decision: proceed with passkeys anyway (see `docs/architecture.md#authentication`).
- [x] **Configure Relying Party settings** for passkeys: Authentication → Passkeys (BETA). RP Display Name `Workout Tracker`, RP ID `rep-970.pages.dev`, RP Origins `https://rep-970.pages.dev`. Confirmed live via `/auth/v1/settings` (`passkeys_enabled: true`).
- [x] **URL Configuration**: Site URL `https://rep-970.pages.dev`, Redirect URLs include that plus `http://localhost:5173` for local dev.
- [x] Disable open sign-ups in Auth settings (Sign In / Providers → "Allow new users to sign up" off). Confirmed live via `/auth/v1/settings` (`disable_signup: true`).
- [x] Pre-create both accounts manually: Authentication → Users → Add user (with Auto Confirm) for both allowed emails, since signups are disabled and no `allowed_users` table is used (see `docs/architecture.md#access-control`).
- [ ] Once you've signed in as both users at least once: try to read/write the other user's rows by ID directly against the REST API while authenticated as one of them. Confirm both fail — this is the full hostile-read test from `docs/architecture.md#row-level-security`, which couldn't be run earlier with no real accounts.

## Decisions only you can make

- [x] Allowed users: dephillips1977@gmail.com (owner, Android), christashouse@hotmail.com (invited, iPhone).
- [x] Platform priority: build and test on Android first; iPhone-specific behavior gets verified once available.
- [ ] App display name, theme color, and icon (or approve a generated default).
- [ ] Custom domain vs. default `*.pages.dev` subdomain.

## Physical device verification

- [x] **Android, browser tab:** magic-link sign-in and passkey registration both worked on `rep-970.pages.dev` in Chrome.
- [ ] **Android, installed PWA — blocked, needs investigation next session.** Chrome's `⋮` menu wasn't offering a real "Install app" option, only something that looked like a plain bookmark/shortcut to the Chrome home page rather than a standalone install. This was tried *before* the placeholder icons existed (see `docs/architecture.md` — the manifest icons 404'd, which fails Chrome's installability check silently, no error shown). Icons are fixed and deployed now; **try installing again first** — it may just work. If not, get a screenshot of the `⋮` menu to diagnose further (e.g. check `chrome://flags` for PWA-related flags, or check manifest validity via Chrome DevTools' Application tab if a PC can mirror the phone).
- [ ] **iPhone** (secondary, once available): confirm iCloud Keychain sync is enabled; test passkey registration *inside the installed home-screen PWA*, not just in a Safari tab — behavior has historically differed between the two; confirm the "Add to Home Screen" flow and app icon look right.

## Not needed for this project

Apple Developer account, a Mac, App Store Connect — the architecture explicitly avoids any native build path.
