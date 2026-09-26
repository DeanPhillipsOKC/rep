---
name: next-item
description: Pick the single highest-ROI open item in docs/backlog.md, implement it, gate on npm run build + npm run test:e2e, and on green commit and push straight to main. Reports a concise change summary (and emails it, if configured) whether shipped or blocked. Works exactly one item per invocation, then stops. Outputs exactly BACKLOG_EMPTY if nothing is eligible.
---

# next-item

Runs one full cycle of this repo's backlog: pick the best open item, implement it, verify it, ship
it. Read `docs/architecture.md` and `docs/backlog.md` first if you haven't already this session
(required reading per `AGENTS.md`).

This repo has no CI/PR gate and pushes straight to `main` by design (see `docs/architecture.md`'s
"Commit & push policy" and `docs/backlog-runner.md`). This skill handles one item per invocation,
including headless use via `codex exec --approve-for-me '$next-item'`. If an approval gate prevents
an action, stop and report it; do not treat the item as a failed implementation or bypass the gate.

## 0. Safety precondition

Run `git status --porcelain`. If it prints anything, stop immediately, make no changes, and output
exactly:

```
UNSAFE_STATE: working tree not clean
```

This also ensures the run never incorporates pre-existing work into its commit.

## 1. Read and parse the backlog

Read `docs/backlog.md`. An item starts with `- [ ]` and continues until the next item or heading;
its title is the first line, excluding the checkbox, optional `**Item <N> —` prefix, and descriptive
text after an em dash. Its `[Effort: <E>, Value: <V>, ROI: <R>...]` tag may be on a later line.
An item is **eligible** only if it has a parseable score tag, is outside `## Human setup / device
verification`, has no `[human]` tag, and has neither `Status: blocked` nor `Status: needs-review`.
Existing items may have no number; identify those by their full title. Never edit human items.

## 2. Select

Among eligible items: highest `ROI` wins. Tie-break by higher `Value`. Still tied: whichever
appears first in the file (document order, not the Priority order summary line).

If there are no eligible items, make no changes and output exactly:

```
BACKLOG_EMPTY
```

## 3. Implement

Read the source files the item's description points at. Make the change following the existing
codebase's patterns (Vue 3 Composition API, Pinia, existing component/composable conventions).
Don't scope-creep beyond what the item describes.

If the change touches the UI, add or extend an e2e spec under `e2e/`. This is a hard requirement
per `docs/architecture.md`, not optional polish. Follow the existing pattern: plain `test()` blocks
(no `describe`), `page.getByRole`/`getByLabel` accessible-name locators, `signInAsTestUser(page)`
from `e2e/fixtures/auth.ts` to start signed in, `goTo(page, view)` from `e2e/fixtures/nav.ts` for
navigation, `dismissCelebrationIfShown(page)` from `e2e/fixtures/celebration.ts` after any "add
set" action in specs not specifically testing that overlay.

## 4. Gate

Run `npm run build` (typecheck). A failure here always means the implementation is wrong; there is
no exception for it. Go to step 6 (fix loop).

If build passes, run `npm run test:e2e`.

## 5. Evaluate the test run

- **All green:** go to step 7.
- **Some failures, and you're confident they're a pre-existing flake unrelated to this change:**
  this repo has documented flake patterns (shared test-account rate-limiting, row-count/pagination
  truncation past 1000 rows; see `docs/backlog-archive.md` items 56 and 57). Don't assume this is
  what's happening; confirm it:
  1. The failing spec(s) must not exercise the feature area this item touched.
  2. Re-run *just those failing spec(s)* in isolation at least once (`npx playwright test <spec
     path>`). If they pass in isolation, or fail in a way that clearly matches a documented
     pre-existing pattern, that's your confirmation.

  If both hold, treat the gate as satisfied and go to step 7, but:
  - Add a new backlog item under `## Testing / tooling` in `docs/backlog.md` describing the
    flaky/failing spec, with its own self-scored `[Effort: N, Value: N, ROI: X]` tag (same
    convention as any new item; the user doesn't want to be asked to score it).
  - Note which spec(s) were excluded and why, both in the eventual commit message and the archive
    entry, referencing the new item's number.

  If you aren't genuinely confident of both points above, this doesn't apply. Treat it as a normal
  red run and go to step 6.
- **Anything else (uncertain or clearly-related failures):** go to step 6.

## 6. On a red gate: debug and retry, don't give up immediately

Read the actual failure output. Diagnose the real cause (implementation bug, or a missing/wrong
e2e spec) and fix it. Re-run the full gate (step 4). Repeat this fix-and-retest cycle up to **4
times total**. Never weaken the gate to force green: no `.skip`, no deleting or loosening an
assertion just to make it pass. A test only gets changed if it was genuinely testing the wrong
thing, and that reasoning must appear in the eventual commit message if you do change one.

Only after 4 genuine attempts still fail:

1. Revert only files changed by this run. Check the diff first; do not use `git reset --hard`.
2. Edit the item's score tag in `docs/backlog.md` in place: append
   `, Status: blocked: <one-line reason summarizing what was tried>` inside its tag. Do not delete
   the item.
3. Regenerate the Priority order line (step 8) to exclude it.
4. Commit only `docs/backlog.md` with a subject that identifies the item.
5. `git push`.
6. Report it (step 9).
7. Stop. Do not select another item in this invocation.

## 7. On green (including a confirmed unrelated flake): ship it

1. Remove the item's entire multi-line bullet from `docs/backlog.md`.
2. Regenerate the Priority order line (step 8).
3. Append one entry to `docs/backlog-archive.md` in its current style, including the title,
   optional item number, date, change summary, and gate result. Get the date from `Get-Date
   -Format yyyy-MM-dd` in PowerShell and the pass count from Playwright's summary.
4. `git add` only the files this run touched (source, e2e specs, `docs/backlog.md`,
   `docs/backlog-archive.md`).
5. One commit. Use the repo's imperative subject style; include `(item <N>)` only if numbered.
6. `git push` immediately. This is what closes the loop: green gate leads to a pushed commit leads
   to Cloudflare Pages deploying it, with no human step in between.
7. Report it (step 9).

## 8. Regenerating the Priority order line

Recompute from scratch: take every currently-eligible item (per step 1's rule, after whatever
edit you just made), sort by ROI descending, then Value descending, then document order. Replace
the numbered list under "Priority order (highest ROI first)" with one numbered entry per item,
using its title and ROI as the current backlog does. Leave the list empty when no items qualify.

## 9. Report the result

Runs whether the item was shipped (step 7) or blocked (step 6) — never for `BACKLOG_EMPTY` or
`UNSAFE_STATE`, since nothing changed in those cases. Two things, always both:

1. **Print a concise summary as your own final response**, formatted exactly as below, so it's
   visible whether this invocation is interactive or headless — this is the fallback that works
   with no setup at all.
2. **Also try to email it**, by running:
   ```
   powershell -File scripts/Send-Notification.ps1 -Subject "<subject>" -Body "<body>"
   ```
   using the same subject/body as the printed summary. The script silently no-ops (exit 0, no
   output) if `GMAIL_SENDER_ADDRESS`/`GMAIL_APP_PASSWORD`/`NOTIFY_EMAIL_RECIPIENTS` aren't set in
   `.env.local` (see `docs/backlog-runner.md#email-notifications-optional` for setup) — treat any
   outcome from this call, success, no-op, or failure, as non-blocking. Never retry it, never let
   it affect step 6/7's own git operations (which have already completed by this point), and never
   report its failure as this invocation's failure.

**Shipped** (subject: `Shipped: <commit subject line>`):
```
### Shipped — <Title> (item <N>)
Files: <comma-separated files touched>
What changed: <1-2 sentence summary — same substance as the docs/backlog-archive.md entry>
Verified: npm run build passed; npm run test:e2e <passed>/<total> passed[, excluded <spec>, tracked as item <M>]
Commit: <subject>
```

**Blocked** (subject: `Backlog item blocked: <item title>`):
```
### Blocked — <Title> (item <N>)
Reason: <the one-line reason from the Status: blocked tag just added>
Attempts: <number of fix/retry cycles tried, up to 4>
```

## Hard rules

- Never touch a `[human]`-tagged item or anything under `## Human setup / device verification`.
- Never run `npm run wipe:account` or any other destructive/admin script. (There's precedent in
  `docs/backlog-archive.md` for an unattended session correctly getting blocked from exactly this;
  don't reach for it.)
- Never force-push. Never create, switch, merge, or rebase branches; this only ever runs on
  whatever branch is currently checked out (expected to be `main`).
- Work exactly one item per invocation, then stop, regardless of outcome.
- Never commit or push with a red, unconfirmed gate.
