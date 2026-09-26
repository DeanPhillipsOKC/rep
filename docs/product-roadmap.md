# RepBunny product roadmap

**Prepared:** 2026-09-25  
**Horizon:** Near-term product work over roughly 3–6 months, plus discovery and readiness gates for a possible wider release. The launch date is not assumed.  
**Decision rule:** Help a lifter record a lift, repeat a routine, or understand strength progress with less effort. Keep personal data private by default and the experience phone first. The current pilot runs on free tiers; a wider product may need a different operating model. See [brand identity](brand-identity.md) and [architecture](architecture.md).

## Product position

RepBunny is a personal strength log being tested with two invited users today. Its potential audience is broader: people who want fast set entry, reusable routines, an intelligible training record, and a little delight at genuine milestones. The two-user limit is a pilot configuration, not a market ceiling. A public launch is a product and operating decision that needs discovery, onboarding, reliability, privacy, and support work. It does not require copying every feature in commercial trackers.

The product is already past a bare prototype: it has passkey-first sign-in, exercises with setup notes and rest settings, templates with ordered exercises and target set counts, prior workout prefill, set editing, workout history, a rest timer with background push, PR celebration, and a post-workout template volume chart. The next product work should make those pieces dependable and faster in real gym conditions.

## What I reviewed

- Read `docs/brand-identity.md`, `docs/architecture.md`, and `docs/backlog.md`; checked the shipped Vue screens, stores, and Playwright coverage.
- Captured 390 × 844 Chromium screenshots of Home, an active freeform workout, History, Templates, and Exercises through a temporary Playwright audit test. The test passed and was removed after the review. The shared automation account has many historical test rows, so counts and crowded lists in those captures do **not** represent the two real users.
- Compared current official product documentation for [Hevy](https://www.hevyapp.com/features/track-workouts/), [Strong](https://help.strongapp.io/article/105-about-templates), [Boostcamp](https://www.boostcamp.app/workout-tracker), and [Fitbod](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works). This is a feature and flow comparison, not a claim about their measured user outcomes.

## Gap assessment

| User job | RepBunny today | Useful external signal | Product judgment |
| --- | --- | --- | --- |
| Log sets quickly between lifts | One exercise and one large set form at a time; previous values prefill sequentially. Planned rows and stronger finish/next actions are already in the [active backlog](backlog.md). | [Hevy](https://www.hevyapp.com/features/track-workouts/) and [Boostcamp](https://www.boostcamp.app/workout-tracker) emphasize visible set rows, prior values, and one-tap completion. | **Highest priority.** Fewer taps in the most repeated flow matter more than new feature breadth. |
| Keep a workout through interruptions | The active workout ID, sets, and elapsed clock live in Pinia memory (`src/stores/workouts.ts`); reload/reopen has no explicit resume path. Writes call Supabase directly. | [Hevy](https://www.hevyapp.com/features/track-workouts/) treats the live session as the primary surface. | **High priority.** A reload, weak gym signal, or app eviction can interrupt a real session. Validate the failure rate in the pilot, then make recovery explicit. |
| Trust the training record | History supports editing and deletion. A prior in-app JSON export was removed 2026-09-26 as unneeded for the pilot (see `docs/backlog-archive.md`); offline queueing is called for by the architecture but doesn't appear in the current app. | Commercial breadth is less relevant than ownership and recoverability for a personal log. | **High priority.** Offline writes are more complex and should be scoped around set logging first; account data portability remains an open decision (see `docs/architecture.md`'s Open decisions), not a current build item. |
| See whether a lift is improving | Home shows weekly activity and a recent PR; History is organized by workout; a template volume chart appears after finishing. There is no dedicated per-exercise history or trend view. | [Hevy](https://www.hevyapp.com/features/gym-progress/) provides exercise-by-exercise history; [Boostcamp](https://www.boostcamp.app/workout-tracker) highlights max weight, volume, and estimated strength trends. | **Medium-high priority.** Start with previous sets and a simple best-set trend for one exercise; avoid a metrics dashboard. |
| Repeat a useful session | Templates can be built manually and ordered, with target set counts. They do not capture target reps/weight, and there is no “save this workout as a template” path. | [Strong](https://help.strongapp.io/article/105-about-templates) lets users turn a completed workout into a template. | **Medium priority.** Let users reuse what they actually did before expanding template planning controls. |
| Handle advanced lifting patterns | RPE and rest timers exist. No explicit warm-up/drop-set types, supersets, plate calculator, or automated programming. | [Hevy](https://www.hevyapp.com/features/) and [Boostcamp](https://www.boostcamp.app/workout-tracker) offer many of these; [Fitbod](https://help.fitbod.me/hc/en-us/sections/360001078993-How-Fitbod-Works) generates training recommendations. | **Conditional.** Use pilot feedback and later target-user research to identify real workarounds. Do not copy the full competitor toolset. |
| Welcome users beyond the pilot | Enrollment is manual, public sign-ups are disabled, and setup assumes an invited user. There is no self-serve account lifecycle or launch support path. | A publicly available product must let an unfamiliar person get started and recover from routine account problems. | **Required for public release.** Research the target segment and first-session journey, then design registration, recovery, support, and abuse controls before opening access. |

## Roadmap

### Now — make the core session fast and legible

1. **Ship the two open UI backlog items:** compact rows for the template's configured set count and clear Bunny Pink primary actions. Keep previous values visible per row, save only completed rows, and keep the rest flow usable while preparing the next set. The existing backlog contains implementation detail and Playwright acceptance cases; it remains the execution source for these two items.
2. **Check the first-workout path on both pilot devices.** Today, Home sends a person with no exercises to another tab before they can log. If that causes setup friction, offer a small “Add exercise” path from the start flow. Do not build a large catalog on speculation.

**Success check:** The pilot users can start a familiar template and log its next set without searching for fields or losing sight of the other planned sets. Have each complete one normal workout on their own device; note taps, pauses, and corrections. The existing Playwright suite should cover row saves, edits, and rest behavior.

### In parallel — learn whether there is a market

- **Choose an initial audience and promise.** Interview a small set of lifters beyond the pilot, especially people currently using notes, spreadsheets, or a general workout tracker. Learn what they repeat, what they lose track of, and which existing tool they would replace. Keep findings separate from feature requests.
- **Test the first-session journey.** Observe whether a new person can create an exercise or routine and log a useful workout without help. Prototype onboarding or a starter routine only if that journey stalls. Measure time to first completed set and whether they return for a second workout, using consented research during the pilot rather than adding tracking by default.
- **Define the launch thesis.** Decide what audience RepBunny serves best, why they would choose it, which devices matter, what level of support is feasible, and whether a free, paid, or other funding model can sustain it. These are decisions to validate, not assumptions baked into the current build.

### Next — make the record resilient

3. **Resume an interrupted workout.** Persist enough active-session state to reopen the current workout after refresh or app eviction, including its template and start time. Provide an explicit Resume / Discard choice. Reconcile with the server before showing saved sets to avoid duplicates. Keep an abandoned workout out of History until it contains actual work.
4. **Protect set entry when connectivity drops.** First make failed saves unmistakable and retryable without duplicate sets. If gym connectivity is a recurring problem, add a small durable queue for set writes and an explicit pending/synced status. The service worker's offline shell alone does not guarantee offline data writes.

**Success check:** A refresh resumes an active workout with the right sets; a failed network write is recoverable once. Test Android first, then verify installed iPhone PWA behavior with the iPhone pilot user. The [human device checks in the backlog](backlog.md) remain human tasks.

### After that — turn history into useful evidence

5. **Add an exercise detail view.** From a live set or History, show the last few sessions for that exercise in set order, plus one simple trend such as heaviest completed set or best set volume. Label units and define how mixed lb/kg entries are handled before charting. Keep the raw numbers visible; a chart is optional if the list answers the question.
6. **Create a template from a finished workout.** Copy the performed exercise order and set counts into an editable template, with a clear choice to keep or change the name. Do not silently change an existing template after a one-off workout.
7. **Improve template targets only where they reduce decisions.** Consider optional rep ranges or a reference weight after the compact-row flow proves itself. Targets should guide entry, not prescribe progression.

**Success check:** A user can answer “What did I do last time on this lift?” while logging, and can turn a useful freeform session into a repeatable routine in under a minute.

### Before a public launch — make access and operations ready

8. **Design self-serve enrollment and recovery.** Move beyond manually seeded accounts only after the first-session journey is useful. Decide how passkeys and recovery work for new users; add email verification, abuse and rate-limit controls, and clear account deletion. Keep each account's data private by default.
9. **Harden multi-account behavior.** Automate hostile cross-account read/write tests, test account deletion, paginate history and exercise queries beyond Supabase's default row limit, and verify data migrations and backups. Decide separately whether account data portability is needed before opening access (see `docs/architecture.md`'s Open decisions). Assess capacity and cost at realistic usage levels before inviting a broader audience.
10. **Prepare a supportable release.** Write concise install and recovery help for Android and iPhone, define how users report failed sync or lost access, add privacy-conscious reliability monitoring, and decide whether free-tier hosting and direct-to-main deployment still fit the release risk.

**Launch gate:** A new person can sign up, finish and later resume a workout, recover access, delete their data, and receive help when a write fails. The system keeps two unrelated accounts isolated under automated tests, and operating costs and support expectations are understood. Launch timing should follow this evidence rather than the calendar.

### Conditional opportunities — revisit with actual usage

- **Warm-up and drop-set labels:** add only if they improve the accuracy of records or PRs for the target audience. Decide whether those sets count toward progress calculations before implementation.
- **Superset grouping:** consider if users regularly alternate lifts and current exercise switching causes mistakes. A label and next-exercise shortcut may be enough.
- **Plate calculator:** small utility if barbell loading math is a real recurring interruption; keep it one tap away from weight entry.
- **Richer trends:** add a second metric only when the simple exercise history leaves a real question unanswered.

## Not prioritized for the current product promise

Social feeds, leaderboards, coaching recommendations, huge program libraries, nutrition, body measurements, activity integrations, and streak pressure are not required to market a focused strength log. Evaluate opt-in sharing or other adjacent features if target-user research shows they help people record, repeat, or understand their training. Public availability is explicitly on this roadmap; public workout visibility is a separate choice and should never be the default.

## How to use this with the backlog

This roadmap sets direction and order. `docs/backlog.md` remains the active implementation queue with effort/value scores and `[human]` flags. Add a roadmap item there only when it is ready to implement with a bounded scope, dependencies, and acceptance criteria. Do not put research hypotheses into the unattended `next-item` queue as if they were approved features.
