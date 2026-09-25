# RepBunny (Workout Tracker PWA)

Installable strength workout tracker, currently in a two-user invite-only pilot (Vue 3 + TS + Supabase + Cloudflare Pages).

Project knowledge lives under `docs/`, shared with any agent working in this repo — read it before making changes:

- `docs/architecture.md` — stack, data model, RLS policies, PWA config, build order, and verification policy. Canonical reference.
- `docs/backlog.md` — active work: features, testing/tooling, and human-only setup tasks (accounts, device testing). Read before starting new work. Items tagged **[human]** are not yours to attempt — flag if one is unchecked and blocking.
- `docs/backlog-archive.md` — cold storage for finished backlog items. Not required reading; check it only for history on something already shipped.
- `docs/ARCHITECTURE.pdf` — original brief `architecture.md` was transcribed from. Treat the markdown as source of truth going forward.

Keep this file and `CLAUDE.md` as thin pointers to `docs/` — put new project knowledge there, not here, so both stay in sync.

Documentation-only changes do not require `npm run build` or `npm run test:e2e`; see the verification and commit policy in `docs/architecture.md`.
