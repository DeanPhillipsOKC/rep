# Backlog runner

Automates the manual "start a session, work the next item by ROI" loop. The Claude skill at
`.claude/skills/next-item/SKILL.md` and the Codex skill at `.agents/skills/next-item/SKILL.md`
pick the highest-ROI open item in `docs/backlog.md`,
implements it, and gates on `npm run build` + `npm run test:e2e`. On green it commits and pushes
straight to `main`, the same way an interactive session already does per
`docs/architecture.md`'s commit & push policy. `scripts/Run-Backlog.ps1` calls it in a loop.

There is no review step in this pipeline. It is built this way on purpose for this two-person
prototype: the priority is getting verified changes into production with as little manual
interaction as possible. If this project ever grows past two people, this whole approach (running
directly on `main`, no review gate) should be revisited before relying on it further.

## Prerequisites

- `claude` or `codex` on PATH, matching the selected `-Agent` value.
- `.env.local` populated per `.env.example`, specifically `TEST_ACCOUNT_EMAIL` and
  `SUPABASE_SERVICE_ROLE_KEY` (these are what let `npm run test:e2e` sign in and run
  non-interactively; see `docs/architecture.md`'s "Testing / automation" section).
- A clean working tree. The skill refuses to run (prints `UNSAFE_STATE: working tree not clean`
  and makes no changes) if `git status` isn't clean when it starts.

## Running it

```powershell
scripts\Run-Backlog.ps1
# Or use Codex:
scripts\Run-Backlog.ps1 -Agent Codex
# To tune either agent:
scripts\Run-Backlog.ps1 -MaxIterations 10 -UsageLimitWaitMinutes 15
```

Each iteration runs `claude -p '/next-item'` by default, or `codex exec --approve-for-me`
with the Codex skill when `-Agent Codex` is selected. The script requires a clean working tree
at startup and works exactly one backlog item per iteration. It keeps going until one of:

- `BACKLOG_EMPTY`: every eligible item is done. Exits successfully.
- Two consecutive iterations produce no new commit: treated as a stall (e.g. the working tree
  wasn't clean, or something is silently failing to make progress). Exits with a warning.
- `MaxIterations` reached.

A usage-limit message from either CLI pauses for `UsageLimitWaitMinutes` and retries the same
iteration without counting it against `MaxIterations` or the stall check.

At the end it prints how many iterations ran, how many items completed, how many were blocked, and
why it stopped.

## Email notifications (optional)

Every `next-item` run — interactive (`/next-item`), headless (`claude -p '/next-item'` or the
Codex equivalent), or looped via `scripts\Run-Backlog.ps1` — emails a short HTML summary card of
what it shipped or blocked, via Gmail SMTP (`scripts\Send-Notification.ps1`). `Run-Backlog.ps1`
separately emails one summary card when the whole run finishes. It's opt-in: if the env vars below
aren't set, `Send-Notification.ps1` silently no-ops and every run behaves exactly as before — the
same concise summary still prints as plain text in the skill's own output either way, so nothing
is lost by skipping email setup.

Set these in `.env.local` (never in Cloudflare Pages — this only runs locally):

```
GMAIL_SENDER_ADDRESS=you@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
NOTIFY_EMAIL_RECIPIENTS=you@gmail.com,partner@example.com
```

`NOTIFY_EMAIL_RECIPIENTS` is comma-separated — add as many addresses as you want to notify.
`GMAIL_APP_PASSWORD` is **not** your normal Gmail password (Google blocks plain-password SMTP
login); generate a dedicated one:

1. Turn on 2-Step Verification on the sending Google account, if it isn't already
   (myaccount.google.com/security).
2. Go to myaccount.google.com/apppasswords, create one named something like "RepBunny backlog
   runner", and copy the 16-character password it generates.
3. Paste that into `GMAIL_APP_PASSWORD`. It only works for SMTP login, not for signing into the
   account normally, and can be revoked independently at any time from the same page.

Shipped-item notifications summarize the same substance as the `docs/backlog-archive.md` entry the
run just wrote: files touched, what changed, and the build/e2e verification result. Blocked-item
notifications reuse the `Status: blocked: <reason>` tag added to `docs/backlog.md`, plus how many
fix/retry cycles were tried. See each `next-item` skill's "Report the result" step for the exact
format.

## Getting a release-notes-style summary

The `run-backlog` skill (`.claude/skills/run-backlog/SKILL.md` for Claude,
`.agents/skills/run-backlog/SKILL.md` for Codex) wraps this script: it runs the loop above, then
reads the `docs/backlog-archive.md` and `docs/backlog.md` diffs the run produced and prints a
shipped/blocked summary in the response, instead of leaving you to read `logs/backlog-runner.log`
by hand. Invoke it (`/run-backlog` interactively, or headless the same way as `next-item`) instead
of calling `Run-Backlog.ps1` directly if you want that summary.

## Reading the log

Every run's full output is appended to `logs/backlog-runner.log` (gitignored), with an iteration
number and timestamp on each entry. If an item ends up blocked, check `docs/backlog.md` for its
`Status: blocked: <reason>` tag first; the log has the full transcript of what was tried if you
need more detail.

## If an item gets blocked

The skill only blocks an item after genuinely trying to fix a red `npm run build` or
`npm run test:e2e` (bounded retries; see the selected agent's `next-item` skill). A blocked item stays
in `docs/backlog.md` with a one-line reason instead of being deleted, so it's easy to find and pick
up by hand. It won't be re-selected automatically; either fix it directly or clear the `Status`
field once it's actually resolved.
