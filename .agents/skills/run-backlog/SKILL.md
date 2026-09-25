---
name: run-backlog
description: Runs scripts/Run-Backlog.ps1 end-to-end to work every eligible backlog item (via the next-item skill, one item per iteration) until the backlog is empty or the run stops, then prints a release-notes-style summary of everything shipped and blocked during the run.
---

# run-backlog

Drives the full backlog loop unattended and then reports back like a release-notes writeup, so
whoever kicked this off doesn't have to piece together what happened across possibly dozens of
`next-item` iterations from `logs/backlog-runner.log` themselves. This skill does the looping (via
`scripts/Run-Backlog.ps1`) and the summarizing; `next-item`, which the script drives underneath,
does exactly one item per invocation and knows nothing about a summary. Read
`docs/backlog-runner.md` first if you haven't already this session. Usable headless via
`codex exec --approve-for-me '$run-backlog'`.

## 1. Preconditions

Run `git status --porcelain`. If it prints anything, stop and report the tree isn't clean instead
of stashing or discarding anything. The script enforces this too, but checking first avoids a
wasted background run that just fails on the same message.

Record the starting commit: `git rev-parse HEAD`. Everything in the eventual summary is scoped to
commits made after this point.

## 2. Run the loop

Run `scripts\Run-Backlog.ps1 -Agent Codex`, passing through any `-MaxIterations` /
`-UsageLimitWaitMinutes` given when this skill was invoked (otherwise leave the script's
defaults). This can run for a long time — potentially many items, each with a full build+e2e
gate — so run it in the background rather than blocking on it synchronously, and wait for the
process to actually exit before moving on. Don't poll `logs/backlog-runner.log` mid-run.

If the script exits non-zero, still proceed to step 3 — a stall or an agent error partway through
is exactly the kind of thing the summary needs to surface, not something to fail silently on.

## 3. Build the summary

Record the ending commit: `git rev-parse HEAD`. If it's unchanged from the starting commit, skip
to step 4 and report zero items shipped — don't invent a release-notes section for a run that made
no commits.

Otherwise, gather:

- `git log --oneline <start>..<end>` — the full list of commits this run made.
- `git diff <start> <end> -- docs/backlog-archive.md` — exactly the archive entries this run
  appended. Each is already written in prose by the `next-item` invocation that shipped it (title,
  files touched, notable decisions, gate result) — use these as the basis for each shipped item's
  summary rather than re-deriving one from the code diff yourself.
- For any commit whose subject starts with `Block item` (see `next-item` step 6): pull the reason
  from the `Status: blocked: <reason>` tag it added to `docs/backlog.md`
  (`git diff <start> <end> -- docs/backlog.md` shows it even if the file has since changed again
  within the same run).

## 4. Report

Output a short release-notes-style summary directly in the response. Don't write it to a file
unless explicitly asked to. Structure:

```
## Backlog run summary

<N> item(s) shipped, <M> blocked, <iteration count> iteration(s), stopped because: <reason>.

### Shipped
- <Title> (item <N>): <one or two sentence summary drawn from the archive entry>
...

### Blocked
- <Title> (item <N>): <reason>
...
```

Omit the "Shipped" or "Blocked" section entirely when empty, rather than printing an empty header.
If nothing shipped and nothing blocked, say so plainly (backlog was already empty, or the run
stalled/failed before completing a single item) — check `logs/backlog-runner.log`'s tail for why
if the reason isn't obvious from the git history.

## Hard rules

- Never touch `docs/backlog.md`, `docs/backlog-archive.md`, or any source file yourself — this
  skill only observes what `next-item` (via the script) already committed. All actual backlog work
  happens inside those invocations, not here.
- Never retry, adjust flags, or re-run the script on your own initiative because the outcome
  wasn't liked; report what happened and stop.
- Never force-push, amend, or rewrite any commit the run made.
