---
name: next-item
description: Pick the single highest-ROI open item in docs/backlog.md, implement it, gate on npm run build + npm run test:e2e, and on green commit and push straight to main. Reports a concise change summary (and emails it, if configured) whether shipped or blocked. Works exactly one item per invocation, then stops. Outputs exactly BACKLOG_EMPTY if nothing is eligible.
---

# next-item

Runs one full cycle of this repo's backlog: pick the best open item, implement it, verify it, ship
it. Read `docs/architecture.md` and `docs/backlog.md` first if you haven't already this session
(required reading per `CLAUDE.md`).

This repo has no CI/PR gate and pushes straight to `main` by design (see `docs/architecture.md`'s
"Commit & push policy" and `docs/backlog-runner.md`). This skill is meant to run unattended,
including headless (`claude -p "/next-item"`), so it must never stop to ask a question; make the
most reasonable call and proceed, or block the item with a clear reason.

## 0. Safety precondition

Run `git status --porcelain`. If it prints anything, stop immediately, make no changes, and output
exactly:

```
UNSAFE_STATE: working tree not clean
```

This precondition is what makes step 7's `git reset --hard HEAD` safe later: it only ever discards
changes *this run itself* made, never pre-existing work.

## 1. Read and parse the backlog

Read `docs/backlog.md`. An item is **eligible** if its line matches
`- [ ] **Item <N> — <title>.** ... [Effort: <E>, Value: <V>, ROI: <R>...]` and the bracketed tag
does **not** contain `Status: blocked` or `Status: needs-review`. Items without a parseable
Effort/Value/ROI tag (this includes everything tagged `[human]`, and everything under the
`## Human setup / device verification` heading) are never eligible. Do not touch them under any
circumstances, regardless of how the parsing goes.

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

1. `git reset --hard HEAD` to discard everything this run changed (safe per step 0).
2. Edit the item's line in `docs/backlog.md` in place: append
   `, Status: blocked: <one-line reason summarizing what was tried>` inside its tag. Do not delete
   the item.
3. Regenerate the Priority order line (step 8) to exclude it.
4. `git add docs/backlog.md && git commit -m "Block item <N>: <reason> (next-item)"`.
5. `git push`.
6. Report it (step 9).
7. Stop. Do not select another item in this invocation.

## 7. On green (including a confirmed unrelated flake): ship it

1. Remove the item's bullet entirely from `docs/backlog.md`.
2. Regenerate the Priority order line (step 8).
3. Append one line to `docs/backlog-archive.md`, matching the file's current format exactly:
   ```
   - <Title> (item <N>, <YYYY-MM-DD>): <what changed, files touched, any notable decisions>.
     Verified via `npm run build` and a full `npm run test:e2e` run (<passed>/<total>[, notes on
     excluded flaky specs and their tracking item if step 5's exception applied]).
   ```
   Get today's date with the Bash tool (`date +%Y-%m-%d`); don't guess it. Get the pass count from
   the Playwright summary line.
4. `git add` only the files this run touched (source, e2e specs, `docs/backlog.md`,
   `docs/backlog-archive.md`).
5. One commit. Subject line style matches this repo's existing history:
   `<imperative summary> (item <N>)`.
6. `git push` immediately. This is what closes the loop: green gate leads to a pushed commit leads
   to Cloudflare Pages deploying it, with no human step in between.
7. Report it (step 9).

## 8. Regenerating the Priority order line

Recompute from scratch: take every currently-eligible item (per step 1's rule, after whatever
edit you just made), sort by ROI descending, then Value descending, then document order. Replace
the line under "Priority order (highest ROI first)" with the resulting item numbers,
comma-separated, in that order.

## 9. Report the result

Runs whether the item was shipped (step 7) or blocked (step 6) — never for `BACKLOG_EMPTY` or
`UNSAFE_STATE`, since nothing changed in those cases. Two things, always both:

1. **Print a concise plain-text summary as your own final response**, formatted exactly as below,
   so it's visible whether this invocation is interactive or headless — this is the fallback that
   works with no setup at all.
2. **Also try to email it as a short HTML card** (not a plain-text dump of the printed summary —
   see templates below). Write the filled-in HTML to a temp file, then run (Bash or PowerShell
   tool):
   ```
   powershell -File scripts/Send-Notification.ps1 -Subject "<subject>" -BodyFile "<path-to-html-file>" -IsHtml
   ```
   The script silently no-ops (exit 0, no output) if `GMAIL_SENDER_ADDRESS`/`GMAIL_APP_PASSWORD`/
   `NOTIFY_EMAIL_RECIPIENTS` aren't set in `.env.local` (see
   `docs/backlog-runner.md#email-notifications-optional` for setup) — treat any outcome from this
   call, success, no-op, or failure, as non-blocking. Never retry it, never let it affect step
   6/7's own git operations (which have already completed by this point), and never report its
   failure as this invocation's failure.

### Terminal summary (plain text)

**Shipped:**
```
Shipped — <Title> (item <N>)
Files: <comma-separated files touched>
What changed: <1-2 sentence summary — same substance as the docs/backlog-archive.md entry>
Verified: npm run build passed; npm run test:e2e <passed>/<total> passed[, excluded <spec>, tracked as item <M>]
Commit: <subject>
```

**Blocked:**
```
Blocked — <Title> (item <N>)
Reason: <the one-line reason from the Status: blocked tag just added>
Attempts: <number of fix/retry cycles tried, up to 4>
```

### Email (HTML card)

Keep the copy in each field as short as the terminal summary — the point is a cleaner layout, not
more words. Use inline styles only (email clients strip `<style>` blocks and external CSS). Colors
and fonts come from `docs/brand-identity.md`'s token table (dark plum surface, Bunny Pink accent,
lavender secondary, Manrope/Baloo 2 with rounded-font fallbacks for clients that can't load them).
The Shipped banner uses the app's own `--accent`/`--accent-text` pairing from `src/style.css`
(`#f2879c` fill, `#241a2c` label — the same colors the app's primary CTA buttons use) with a
checkmark, not the plain green from an earlier version — green wasn't in the app's palette at all.
Blocked uses the app's own `--danger` token (`#e0687a`, white text — the exact styling of the app's
`.danger` buttons, e.g. "Confirm delete") with a matching ✕ for the same done/not-done visual
language.
Fill the placeholders (ALL-CAPS tokens) and send exactly this markup, changing nothing else about
the structure. The label column has a fixed width and every value cell has
`word-break:break-word;overflow-wrap:anywhere` with `table-layout:fixed` on the table itself, and
there's no `overflow:hidden` anywhere on the card — that combination is what a prior version of
this template got wrong: an auto-sized table let long unbroken tokens (file paths, run-on
sentences) push a column wider than the 520px card, and `overflow:hidden` on the card silently
clipped the overflow instead of wrapping it. Keep all three in place if you ever touch this markup.

**Shipped** (subject: `Shipped: <commit subject line>`):
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Manrope,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:520px;width:100%;margin:0 auto;background:#211829;border-radius:14px;">
      <div style="padding:14px 20px;background:#17111c;border-radius:14px 14px 0 0;">
        <span style="font-family:'Baloo 2',ui-rounded,Segoe UI,Arial,sans-serif;color:#f2879c;font-size:14px;font-weight:700;">🐰 RepBunny</span>
      </div>
      <div style="padding:10px 20px;background:#f2879c;">
        <span style="color:#241a2c;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">&#10003; Shipped</span>
      </div>
      <div style="padding:20px;background:#211829;border-radius:0 0 14px 14px;">
        <h2 style="margin:0 0 2px;font-family:'Baloo 2',ui-rounded,Segoe UI,Arial,sans-serif;font-size:18px;color:#f2879c;word-break:break-word;overflow-wrap:anywhere;">TITLE</h2>
        <p style="margin:0 0 16px;font-size:12px;color:#b79cf0;">Item N</p>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px;color:#f5edf2;">
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">What changed</td><td style="padding:5px 0;word-break:break-word;overflow-wrap:anywhere;">SUMMARY</td></tr>
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">Files</td><td style="padding:5px 0;font-family:Consolas,monospace;font-size:12px;color:#b9a8c2;word-break:break-word;overflow-wrap:anywhere;">FILES</td></tr>
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">Verified</td><td style="padding:5px 0;word-break:break-word;overflow-wrap:anywhere;">VERIFIED</td></tr>
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">Commit</td><td style="padding:5px 0;font-family:Consolas,monospace;font-size:12px;color:#b9a8c2;word-break:break-word;overflow-wrap:anywhere;">COMMIT</td></tr>
        </table>
      </div>
    </div>
  </body>
</html>
```

**Blocked** (subject: `Backlog item blocked: <item title>`) — same shape, coral banner, two rows:
```html
<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0;padding:24px;background:#f3f4f6;font-family:Manrope,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <div style="max-width:520px;width:100%;margin:0 auto;background:#211829;border-radius:14px;">
      <div style="padding:14px 20px;background:#17111c;border-radius:14px 14px 0 0;">
        <span style="font-family:'Baloo 2',ui-rounded,Segoe UI,Arial,sans-serif;color:#f2879c;font-size:14px;font-weight:700;">🐰 RepBunny</span>
      </div>
      <div style="padding:10px 20px;background:#e0687a;">
        <span style="color:#ffffff;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">&#10007; Blocked</span>
      </div>
      <div style="padding:20px;background:#211829;border-radius:0 0 14px 14px;">
        <h2 style="margin:0 0 2px;font-family:'Baloo 2',ui-rounded,Segoe UI,Arial,sans-serif;font-size:18px;color:#f2879c;word-break:break-word;overflow-wrap:anywhere;">TITLE</h2>
        <p style="margin:0 0 16px;font-size:12px;color:#b79cf0;">Item N</p>
        <table style="width:100%;table-layout:fixed;border-collapse:collapse;font-size:14px;color:#f5edf2;">
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">Reason</td><td style="padding:5px 0;word-break:break-word;overflow-wrap:anywhere;">REASON</td></tr>
          <tr><td style="width:84px;padding:5px 10px 5px 0;color:#b79cf0;font-size:12px;vertical-align:top;">Attempts</td><td style="padding:5px 0;word-break:break-word;overflow-wrap:anywhere;">ATTEMPTS</td></tr>
        </table>
      </div>
    </div>
  </body>
</html>
```

## Hard rules

- Do every step yourself in the current session. Never spawn a sub-agent (the `Agent`/`Task` tool,
  including `Explore` or `general-purpose`) for any part of this: reading the backlog, searching
  the codebase, implementing, or diagnosing a red gate. A fresh sub-agent re-derives context this
  session already has, and that re-derivation burns far more tokens than just doing the work
  inline — the opposite of what a token-conscious unattended run needs.
- Never touch a `[human]`-tagged item or anything under `## Human setup / device verification`.
- Never run `npm run wipe:account` or any other destructive/admin script. (There's precedent in
  `docs/backlog-archive.md` for an unattended session correctly getting blocked from exactly this;
  don't reach for it.)
- Never force-push. Never create, switch, merge, or rebase branches; this only ever runs on
  whatever branch is currently checked out (expected to be `main`).
- Work exactly one item per invocation, then stop, regardless of outcome.
- Never commit or push with a red, unconfirmed gate.
