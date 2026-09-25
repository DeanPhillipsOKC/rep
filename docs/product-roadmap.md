# RepBunny product roadmap

**Prepared:** 2026-09-25  
**Horizon:** The next 3–6 months of product work, sequenced by value rather than calendar promises.  
**Decision rule:** Help either invited user record a lift, repeat a routine, or understand strength progress with less effort. Keep the app private, phone first, and free to run. See [brand identity](brand-identity.md) and [architecture](architecture.md).

## Product position

RepBunny is a personal strength log for two people. Its advantage is focus: fast set entry, reusable routines, an intelligible training record, and a little delight at genuine milestones. It should not pursue a public network, a coaching algorithm, nutrition, or a large exercise media library to match the breadth of commercial apps. Those would add upkeep and screen weight without strengthening the core promise.

The product is already past a bare prototype: it has passkey-first sign-in, exercises with setup notes and rest settings, templates with ordered exercises and target set counts, prior workout prefill, set editing, workout history, a rest timer with background push, PR celebration, and a post-workout template volume chart. The next product work should make those pieces dependable and faster in real gym conditions.

## What I reviewed

- Read `docs/brand-identity.md`, `docs/architecture.md`, and `docs/backlog.md`; checked the shipped Vue screens, stores, and Playwright coverage.
- Captured 390 × 844 Chromium screenshots of Home, an active freeform workout, History, Templates, and Exercises through a temporary Playwright audit test. The test passed and was removed after the review. The shared automation account has many historical test rows, so counts and crowded lists in those captures do **not** represent the two real users.
- Compared current official product documentation for [Hevy](https://www.hevyapp.com/features/track-workouts/), [Strong](https://help.strongapp.io/article/105-about-templates), [Boostcamp](https://www.boostcamp.app/workout-tracker), and [Fitbod](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works). This is a feature and flow comparison, not a claim about their measured user outcomes.

## Gap assessment

| User job | RepBunny today | Useful external signal | Product judgment |
| --- | --- | --- | --- |
| Log sets quickly between lifts | One exercise and one large set form at a time; previous values prefill sequentially. Planned rows and stronger finish/next actions are already in the [active backlog](backlog.md). | [Hevy](https://www.hevyapp.com/features/track-workouts/) and [Boostcamp](https://www.boostcamp.app/workout-tracker) emphasize visible set rows, prior values, and one-tap completion. | **Highest priority.** Fewer taps in the most repeated flow matter more than new feature breadth. |
| Keep a workout through interruptions | The active workout ID, sets, and elapsed clock live in Pinia memory (`src/stores/workouts.ts`); reload/reopen has no explicit resume path. Writes call Supabase directly. | [Hevy](https://www.hevyapp.com/features/track-workouts/) treats the live session as the primary surface. | **High priority.** A reload, weak gym signal, or app eviction can interrupt a real session. Validate the failure rate with the two users, then make recovery explicit. |
| Trust the training record | History supports editing and deletion. The architecture calls for data export and offline queueing, but neither appears in the current app. | Commercial breadth is less relevant than ownership and recoverability for a private log. | **High priority.** Export is a small, valuable escape hatch; offline writes are more complex and should be scoped around set logging first. |
| See whether a lift is improving | Home shows weekly activity and a recent PR; History is organized by workout; a template volume chart appears after finishing. There is no dedicated per-exercise history or trend view. | [Hevy](https://www.hevyapp.com/features/gym-progress/) provides exercise-by-exercise history; [Boostcamp](https://www.boostcamp.app/workout-tracker) highlights max weight, volume, and estimated strength trends. | **Medium-high priority.** Start with previous sets and a simple best-set trend for one exercise; avoid a metrics dashboard. |
| Repeat a useful session | Templates can be built manually and ordered, with target set counts. They do not capture target reps/weight, and there is no “save this workout as a template” path. | [Strong](https://help.strongapp.io/article/105-about-templates) lets users turn a completed workout into a template. | **Medium priority.** Let users reuse what they actually did before expanding template planning controls. |
| Handle advanced lifting patterns | RPE and rest timers exist. No explicit warm-up/drop-set types, supersets, plate calculator, or automated programming. | [Hevy](https://www.hevyapp.com/features/) and [Boostcamp](https://www.boostcamp.app/workout-tracker) offer many of these; [Fitbod](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works) generates training recommendations. | **Conditional.** Ask the two users which patterns repeatedly cause workarounds. Do not copy the full competitor toolset. |

## Roadmap

### Now — make the core session fast and legible

1. **Ship the two open UI backlog items:** compact rows for the template's configured set count and clear Bunny Pink primary actions. Keep previous values visible per row, save only completed rows, and keep the rest flow usable while preparing the next set. The existing backlog contains implementation detail and Playwright acceptance cases; it remains the execution source for these two items.
2. **Check the first-workout path on both real devices.** Today, Home sends a person with no exercises to another tab before they can log. If either user still experiences setup friction, offer a small “Add exercise” path from the start flow. Do not build a large catalog on speculation.

**Success check:** Both users can start a familiar template and log its next set without searching for fields or losing sight of the other planned sets. Have each user complete one normal workout on their own device; note taps, pauses, and corrections. The existing Playwright suite should cover row saves, edits, and rest behavior.

### Next — make the record resilient

3. **Resume an interrupted workout.** Persist enough active-session state to reopen the current workout after refresh or app eviction, including its template and start time. Provide an explicit Resume / Discard choice. Reconcile with the server before showing saved sets to avoid duplicates. Keep an abandoned workout out of History until it contains actual work.
4. **Add a private data export.** Download the user's own exercises, templates, workouts, and sets as a versioned JSON file, with a simple description of what it contains. A CSV of sets can follow if the users actually want spreadsheet analysis. Verify that export excludes the other account under RLS.
5. **Protect set entry when connectivity drops.** First make failed saves unmistakable and retryable without duplicate sets. If gym connectivity is a recurring problem, add a small durable queue for set writes and an explicit pending/synced status. The service worker's offline shell alone does not guarantee offline data writes.

**Success check:** A refresh resumes an active workout with the right sets; a failed network write is recoverable once; an export can be opened and independently counted against the user's History. Test Android first, then verify installed iPhone PWA behavior with the iPhone user. The [human device checks in the backlog](backlog.md) remain human tasks.

### After that — turn history into useful evidence

6. **Add an exercise detail view.** From a live set or History, show the last few sessions for that exercise in set order, plus one simple trend such as heaviest completed set or best set volume. Label units and define how mixed lb/kg entries are handled before charting. Keep the raw numbers visible; a chart is optional if the list answers the question.
7. **Create a template from a finished workout.** Copy the performed exercise order and set counts into an editable template, with a clear choice to keep or change the name. Do not silently change an existing template after a one-off workout.
8. **Improve template targets only where they reduce decisions.** Consider optional rep ranges or a reference weight after the compact-row flow proves itself. Targets should guide entry, not prescribe progression.

**Success check:** Each user can answer “What did I do last time on this lift?” while logging, and can turn a useful freeform session into a repeatable routine in under a minute.

### Conditional opportunities — revisit with actual usage

- **Warm-up and drop-set labels:** add only if they improve the accuracy of records or PRs for these users. Decide whether those sets count toward progress calculations before implementation.
- **Superset grouping:** consider if both users regularly alternate lifts and current exercise switching causes mistakes. A label and next-exercise shortcut may be enough.
- **Plate calculator:** small utility if barbell loading math is a real recurring interruption; keep it one tap away from weight entry.
- **Richer trends:** add a second metric only when the simple exercise history leaves a real question unanswered.

## Explicitly outside this roadmap

Public profiles, social feeds, leaderboards, coaching recommendations, huge program libraries, nutrition, body measurements, activity integrations, and streak pressure. Competitors offer some of these, but they conflict with the [brand boundary](brand-identity.md) or the two-user operating model. Revisit only if the product purpose itself changes.

## How to use this with the backlog

This roadmap sets direction and order. `docs/backlog.md` remains the active implementation queue with effort/value scores and `[human]` flags. Add a roadmap item there only when it is ready to implement with a bounded scope, dependencies, and acceptance criteria. Do not put research hypotheses into the unattended `next-item` queue as if they were approved features.
