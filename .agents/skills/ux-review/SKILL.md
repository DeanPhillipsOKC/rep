---
name: ux-review
description: Drives the app as a senior UX reviewer would — captures screenshots across onboarding, a normal logging session, and exercise/template management, then adds scored backlog items for real, unfixed UX issues. Every finding is verified against the live source and deduped against docs/backlog.md and docs/backlog-archive.md before being logged. User-triggered, not run automatically.
---

# ux-review

Reviews the app's UI the way a senior UX developer would: look at real screens across the main
journeys, judge them on visual polish, alignment, touch-target size, legibility (this app's
audience includes users with presbyopia/farsightedness — see the set-row-redesign item in
`docs/backlog.md`), and clarity, then write up anything genuinely wrong as a scored backlog item.

There's direct precedent for this in the repo: `docs/backlog.md`'s note above the Features section
describes items 49–55 coming from exactly this kind of screenshot-based review, done once by hand.
Several of that review's initial claims turned out to already be fixed once checked against the
actual source, and were dropped rather than logged — that verification step is not optional, it's
the entire difference between this being useful and this being noise. Read `docs/architecture.md`
and `docs/backlog.md` first if you haven't already this session (required reading per
`AGENTS.md`), and skim `docs/backlog-archive.md` for anything relevant already shipped.

## 1. Make sure the dev server is up

Check `http://localhost:5173` (e.g. a quick `curl -s -o /dev/null -w '%{http_code}'`). If it's
already responding, leave it alone — don't touch a server the user may be relying on elsewhere.
If nothing's there, start `npm run dev` yourself in the background and remember to stop it again
in step 5.

## 2. Capture screenshots

Run:

```
node scripts/capture-ux-screenshots.mjs
```

This drives a mobile viewport (iPhone 13) through onboarding, exercise/template creation and their
edit/delete/archive confirm steps, starting and logging a workout against a template (including
the record-celebration and rest-timer overlays if they fire), switching exercises mid-workout,
finishing, and editing a set in History — all against the dedicated `TEST_ACCOUNT_EMAIL` account,
never either real pilot account. It prints a JSON manifest (`outDir` plus each screenshot's
filename and label) and cleans up every row it created before exiting, so re-running this never
accumulates test data. If a selector inside it breaks because the UI changed shape, fix the script
the same way you'd fix a stale e2e spec — it's maintained the same way, just outside the
`test:e2e` gate since it makes no assertions.

Note as of 2026-09-25: the shared test account currently has real leftover clutter from an
unrelated e2e-cleanup gap (see the "E2E-stamped rows are still leaking" item in
`docs/backlog.md`) — dozens of stray `E2E ...`-named templates unrelated to this run. That's a
pre-existing data-hygiene issue, not something this skill causes or needs to work around beyond
what the capture script's stamped naming already isolates it from.

## 3. Review every screenshot

Read each file in the manifest's `outDir` (the Read tool renders PNGs directly). For each screen,
look with a senior-UX eye at:

- **Alignment and layout** — do elements line up to a clean grid, or does content wrap/spill
  unevenly (the set-row and exercise-chip issues already in `docs/backlog.md` are the shape of
  thing to catch here)?
- **Touch targets and sizing** — is anything cramped or fiddly to tap accurately on a real phone?
- **Legibility** — text size/contrast, especially for the farsightedness consideration already
  called out in the set-row redesign item.
- **Clarity and safety of the flow** — is any state ambiguous, easy to trigger by accident, or
  missing feedback (the "no default selection" and "resume an accidentally-finished workout"
  items in `docs/backlog.md` are exactly this category)?
- **Consistency** — with the rest of the app and with the brand identity (cute, functional, cool —
  see the canvas mockup link above the Features section in `docs/backlog.md`).

Take real UX issues seriously; don't manufacture findings to have something to report. A clean
screen is a fine outcome.

## 4. Verify every candidate finding before logging it

For each thing that looks wrong in a screenshot:

1. **Read the actual source** backing that screen (the relevant `.vue`/CSS) and confirm the issue
   is real and current, not something already fixed since the screenshot's build, and not a
   screenshot artifact (headless rendering quirk, animation caught mid-transition, etc.).
2. **Check it's not already tracked** — search `docs/backlog.md` for an existing open item
   covering the same UI area. If one exists and your finding adds detail, enrich that item instead
   of creating a duplicate (this is what happened earlier this session with the set-row spillover
   report). If your finding is materially different, it's a new item.
3. **Check it's not already shipped** — skim `docs/backlog-archive.md` for the same area. Drop the
   finding if it's already fixed.

Findings that don't survive this step get silently dropped, the same way the original items 49–55
review dropped several of its own initial claims. Don't log something you haven't checked against
the live source.

## 5. Log surviving findings and clean up

For each real, novel finding: add a backlog item to `docs/backlog.md` in the same style as the
rest of the file — cite the specific screenshot filename and the source location backing the
claim, and give it its own `[Effort: N, Value: N, ROI: X]` tag (self-scored; the user doesn't want
to be asked). Regenerate the "Priority order" line the same way `next-item` does (highest ROI
first, tie-break by Value, then document order).

If you started the dev server in step 1, stop it now.

Delete every screenshot run's directory under `logs/ux-review/` except the one from this
invocation, so repeated runs don't pile up gitignored screenshots forever. Leave this run's own
screenshots in place — the user may want to spot-check a finding against the actual image.

If any item was added, commit and push `docs/backlog.md` immediately, the same as any other
docs-only backlog edit in this repo (`docs/architecture.md`'s commit & push policy — no
build/e2e gate applies to a documentation-only change). Commit subject: `Add backlog item(s) from
ux-review: <short summary>`. If nothing was added, there's nothing to commit.

## 6. Report

Summarize directly in your response, not a file:

```
## UX review

<N> screen(s) reviewed, <M> new backlog item(s) added.

### Added
- <Title>: <one-sentence reason, citing the screenshot and source location>
...

### Checked and dropped (already fixed, or not actually a problem)
- <what it looked like> — <why it was dropped>
...
```

Omit the "Checked and dropped" section if nothing was dropped. If nothing was added at all, say so
plainly rather than padding the report.

## Hard rules

- Never invent a finding you haven't verified against the current source.
- Never log a duplicate of an existing open or already-shipped backlog item — enrich instead.
- Never touch a `[human]`-tagged item or anything under `## Human setup / device verification`.
- Never run against the two real pilot accounts — `scripts/capture-ux-screenshots.mjs` only ever
  uses `TEST_ACCOUNT_EMAIL`, and this skill never changes that.
- This skill only edits `docs/backlog.md` (plus, if you needed to fix a stale selector, the
  capture script). It doesn't fix the UX issues it finds — that's `next-item`'s job on a later
  invocation, once a human has had a chance to glance over what got added.
