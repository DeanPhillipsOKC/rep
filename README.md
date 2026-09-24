# REP (Workout Tracker PWA)

Private, installable workout tracker for two users. Vue 3 + TS + Supabase + Cloudflare Pages.

- Architecture and build order: [`docs/architecture.md`](docs/architecture.md)
- Backlog (active work, incl. human setup/device testing): [`docs/backlog.md`](docs/backlog.md)

## Local dev

```
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm install
npm run dev
```

## Browser / E2E automation

Real auth is passkey + magic-link only, so it can't be scripted directly. `npm run test:session`
mints a real session for a dedicated test account instead — see
[`docs/architecture.md#testing--automation`](docs/architecture.md#testing--automation). Requires
`SUPABASE_SERVICE_ROLE_KEY` and `TEST_ACCOUNT_EMAIL` in `.env.local` (never committed).

Playwright end-to-end tests live in `e2e/` and use that same session-minting to start already
signed in:

```
npx playwright install chromium   # first time only
npm run test:e2e
```
