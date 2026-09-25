# Backlog runner

Automates the manual "start a session, work the next item by ROI" loop:
`.claude/skills/next-item/SKILL.md` picks the highest-ROI open item in `docs/backlog.md`,
implements it, and gates on `npm run build` + `npm run test:e2e`. On green it commits and pushes
straight to `main`, the same way an interactive session already does per
`docs/architecture.md`'s commit & push policy. `scripts/Run-Backlog.ps1` calls it in a loop.

There is no review step in this pipeline. It is built this way on purpose for this two-person
prototype: the priority is getting verified changes into production with as little manual
interaction as possible. If this project ever grows past two people, this whole approach (running
directly on `main`, no review gate) should be revisited before relying on it further.

## Prerequisites

- `claude` on PATH.
- `.env.local` populated per `.env.example`, specifically `TEST_ACCOUNT_EMAIL` and
  `SUPABASE_SERVICE_ROLE_KEY` (these are what let `npm run test:e2e` sign in and run
  non-interactively; see `docs/architecture.md`'s "Testing / automation" section).
- A clean working tree. The skill refuses to run (prints `UNSAFE_STATE: working tree not clean`
  and makes no changes) if `git status` isn't clean when it starts.

## Running it

```powershell
scripts\Run-Backlog.ps1
# or, to tune it:
scripts\Run-Backlog.ps1 -MaxIterations 10 -UsageLimitWaitMinutes 15
```

Each iteration runs `claude -p "/next-item"` once, which works exactly one backlog item (or
reports the backlog is empty). The script keeps going until one of:

- `BACKLOG_EMPTY`: every eligible item is done. Exits successfully.
- Two consecutive iterations produce no new commit: treated as a stall (e.g. the working tree
  wasn't clean, or something is silently failing to make progress). Exits with a warning.
- `MaxIterations` reached.

A usage-limit message from Claude pauses for `UsageLimitWaitMinutes` and retries the same
iteration without counting it against `MaxIterations` or the stall check.

At the end it prints how many iterations ran, how many items completed, how many were blocked, and
why it stopped.

## Reading the log

Every run's full output is appended to `logs/backlog-runner.log` (gitignored), with an iteration
number and timestamp on each entry. If an item ends up blocked, check `docs/backlog.md` for its
`Status: blocked: <reason>` tag first; the log has the full transcript of what was tried if you
need more detail.

## If an item gets blocked

The skill only blocks an item after genuinely trying to fix a red `npm run build` or
`npm run test:e2e` (bounded retries; see `.claude/skills/next-item/SKILL.md`). A blocked item stays
in `docs/backlog.md` with a one-line reason instead of being deleted, so it's easy to find and pick
up by hand. It won't be re-selected automatically; either fix it directly or clear the `Status`
field once it's actually resolved.
