<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExercisesStore } from '../stores/exercises'
import { usePushSubscriptionStore } from '../stores/pushSubscription'
import { useTemplatesStore } from '../stores/templates'
import { useWorkoutsStore } from '../stores/workouts'
import AddExerciseSheet from './AddExerciseSheet.vue'
import ExerciseHistoryDetail from './ExerciseHistoryDetail.vue'
import RecordCelebration from './RecordCelebration.vue'
import RestTimer from './RestTimer.vue'
import VolumeChart from './VolumeChart.vue'
import type { SetEntry, SetWithExercise, WeightUnit } from '../lib/types'

const exercises = useExercisesStore()
const push = usePushSubscriptionStore()
const templates = useTemplatesStore()
const workout = useWorkoutsStore()
const router = useRouter()

// Backlog item 26: pre-start guidance points a brand-new account at the
// Exercises/Templates tabs — routed directly rather than bubbled up through
// an emit, now that App.vue no longer owns a `view` ref to switch (router.ts).

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const notes = ref('')
// Backlog item 1 (template-or-freeform choice): `null` is the sentinel for
// "nothing picked yet", distinct from `''` which means Freeform was
// explicitly chosen — without that distinction, an untouched start screen
// looked identical to a deliberate Freeform pick and "Start workout" would
// silently start freeform.
const templateId = ref<string | null>(null)
const exerciseId = ref('')
const errorMessage = ref('')

// Backlog item 38: full-screen celebration takeover when a set beats the
// all-time best for that exercise, replacing the old auto-dismissing
// bottom toast (docs/backlog-archive.md item 4) — requires an explicit
// dismiss (RecordCelebration.vue) rather than fading on its own.
const recordCelebration = ref<{
  exerciseId: string
  reps: number
  weight: number
  weightUnit: WeightUnit
  previousBest: number
} | null>(null)

// addSet's record check runs in the background (see workouts.ts) so it
// never delays the add; react to it landing whenever it does.
watch(
  () => workout.newRecord,
  (record) => {
    if (record) recordCelebration.value = record
  },
)

onMounted(() => {
  if (exercises.exercises.length === 0) exercises.fetchExercises()
  if (templates.templates.length === 0) templates.fetchTemplates()
  workout.fetchProgressStats()
  workout.fetchRecentlyLoggedExercises()
  document.addEventListener('visibilitychange', handleRestVisibilityChange)
  elapsedTimerHandle = window.setInterval(() => {
    elapsedNow.value = Date.now()
  }, 1000)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleRestVisibilityChange)
  if (elapsedTimerHandle !== null) window.clearInterval(elapsedTimerHandle)
  clearInterval(miniRestInterval)
})

// Backlog item 50: dynamic header while a workout is active — template name
// (or "Freeform workout") plus a running elapsed-time clock, replacing the
// heading that used to read "Log a workout" throughout. `elapsedNow` ticks
// once a second purely to keep `elapsedLabel` reactive; the real source of
// truth is `activeWorkoutStartedAt` (stores/workouts.ts), set when the
// workout row is created.
const elapsedNow = ref(Date.now())
let elapsedTimerHandle: number | null = null

const activeTemplateName = computed(() => {
  if (!workout.activeTemplateId) return null
  return templates.templates.find((t) => t.id === workout.activeTemplateId)?.name ?? null
})

const headerTitle = computed(() => {
  if (!workout.activeWorkoutId) return 'Log a workout'
  return activeTemplateName.value ?? 'Freeform workout'
})

const elapsedLabel = computed(() => {
  if (!workout.activeWorkoutId || !workout.activeWorkoutStartedAt) return null
  const totalSeconds = Math.max(0, Math.floor((elapsedNow.value - workout.activeWorkoutStartedAt) / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0')
  const seconds = String(totalSeconds % 60).padStart(2, '0')
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
})

// Backlog item 3: sets from the previous workout against this template,
// grouped by exercise in the order they were logged, so the reps/weight
// pre-fill (item 21's applyPrefillToRow below) can read off it. Used to also
// back a "Last time" summary card; removed in the redesign (item 67) since
// the per-row pre-fill already surfaces the same numbers.
const previousSetsByExercise = computed(() => {
  const grouped: Record<string, SetWithExercise[]> = {}
  for (const set of workout.previousWorkout?.sets ?? []) {
    ;(grouped[set.exercise_id] ??= []).push(set)
  }
  return grouped
})

// Backlog item 25: a template can still reference an exercise after it's
// been archived (archiving only flips exercises.is_archived, it doesn't
// touch workout_template_exercises), so this filters archived exercises out
// of the carousel deck below rather than treating the join table as the
// source of truth for what's loggable. Checks the live
// exercises store rather than te.exercises.is_archived from the cached join
// — that join is a snapshot from whenever the template's exercises were
// last fetched, which templates.exercisesByTemplate only ever does once per
// template per session, so it goes stale the moment an exercise still
// showing in it gets archived later in the same session.
const activeTemplateExercises = computed(() => {
  if (!workout.activeTemplateId) return []
  return (templates.exercisesByTemplate[workout.activeTemplateId] ?? []).filter(
    (te) => !exercises.exercises.find((e) => e.id === te.exercise_id)?.is_archived,
  )
})

// Redesign item 67: the swipeable carousel's deck of exercises for the
// active workout, replacing the old chip row + <select> (which item 21
// scoped a templated workout's dropdown to the template's own exercises).
// That auto-populated part of the deck stays template-scoped for the same
// reason item 21 gave (an ad-hoc addition leaking into the "last time"/
// volume-chart reporting) — but the carousel's persistent "+" now
// deliberately allows adding any active exercise on top of it (an ad-hoc
// addition, or the whole deck for a freeform workout), per the redesign's
// canvas note: "for anything outside the template or building a freeform
// session from scratch." adHocExerciseIds tracks those additions for this
// session (reset on start/resume, see handleStart etc. below); the fallback
// over activeSets covers a resumed workout whose ad-hoc addition was made in
// an earlier session and so never repopulated adHocExerciseIds.
const adHocExerciseIds = ref<string[]>([])

const workoutExerciseIds = computed(() => {
  const ids: string[] = []
  const seen = new Set<string>()
  function add(id: string) {
    if (seen.has(id)) return
    seen.add(id)
    ids.push(id)
  }
  for (const te of activeTemplateExercises.value) add(te.exercise_id)
  for (const id of adHocExerciseIds.value) add(id)
  for (const set of workout.activeSets) add(set.exercise_id)
  return ids
})

const currentExerciseIndex = computed(() => workoutExerciseIds.value.indexOf(exerciseId.value))

// Drives which way the exercise-card transition below slides -- 1 for
// forward (dot/swipe/next moving to a later position in the deck), -1 for
// backward. Computed here rather than separately in each caller (dots,
// peek buttons, swipe, the add-exercise sheet) since they all funnel
// through this one function.
const slideDirection = ref(1)

function selectExercise(id: string) {
  const newIndex = workoutExerciseIds.value.indexOf(id)
  const oldIndex = currentExerciseIndex.value
  if (newIndex !== -1 && oldIndex !== -1) slideDirection.value = newIndex >= oldIndex ? 1 : -1
  exerciseId.value = id
}

// Redesign item 67 follow-up: the set-rows panel (unit toggle + set rows +
// "Add row") slides/fades in step with the exercise card so both areas read
// as one thing moving together, instead of the card animating while this
// larger area's values just snapped to the next exercise's. A keyed
// <Transition> (like the exercise card uses) would remount these rows,
// which briefly leaves no "Reps"/"Weight" field in the DOM for the
// incoming exercise while the outgoing one plays its leave transition — a
// real gap where a fast tap/keystroke lands on the wrong (about-to-be-
// removed) exercise's fields. Instead this replays a plain CSS keyframe
// animation on the same, never-remounted DOM node: the row list still
// updates in the same tick as `exerciseId` (ordinary Vue reactivity, no
// gap), and the animation is purely decorative on top of that. Toggling the
// class off/on with a forced reflow between is what makes the animation
// replay on a second swipe in the same direction, since re-adding a class
// that's already present doesn't restart a CSS animation on its own.
const setRowsPanelEl = ref<HTMLElement | null>(null)

watch(exerciseId, () => {
  const el = setRowsPanelEl.value
  if (!el) return
  const animationClass = slideDirection.value >= 0 ? 'set-rows-panel-anim-next' : 'set-rows-panel-anim-prev'
  el.classList.remove('set-rows-panel-anim-next', 'set-rows-panel-anim-prev')
  void el.offsetWidth
  el.classList.add(animationClass)
})

function goToDeckOffset(delta: number) {
  const ids = workoutExerciseIds.value
  if (ids.length === 0) return
  const current = currentExerciseIndex.value
  const next = current === -1 ? 0 : Math.min(Math.max(current + delta, 0), ids.length - 1)
  selectExercise(ids[next])
}

function goToPreviousExercise() {
  goToDeckOffset(-1)
}

function goToNextExercise() {
  goToDeckOffset(1)
}

// Real swipe support (not just the peek buttons/dots) via pointer events,
// which unify touch/mouse/pen instead of needing separate touch handlers.
// Bound on the whole active-workout screen (not just the exercise card)
// per the redesign follow-up -- a swipe starting anywhere over the set
// rows, notes, etc. still moves the carousel, not just a drag confined to
// the small card itself. `setPointerCapture` keeps delivering move/up
// events to this element even once the finger has moved outside its bounds
// mid-drag — without it, a real swipe (which almost always drifts off the
// starting element) never reaches `handleWorkoutPointerUp` and only the
// on-screen prev/next buttons end up doing anything. The screen's
// `touch-action: pan-y` (below) is the other half of this: it stops the
// browser from treating a horizontal drag as a page-scroll/navigation
// gesture before our own handler ever sees it, while still letting a
// vertical drag scroll the page normally.
let dragStartX: number | null = null

function handleWorkoutPointerDown(event: PointerEvent) {
  // A pointerdown starting on a button/link/form field (e.g. "View exercise
  // history", a weight input, the lb/kg toggle) must not be captured here --
  // setPointerCapture on an ancestor redirects the browser's click-target
  // hit-testing to the captured element, which silently swallows that
  // control's own click/focus.
  if ((event.target as HTMLElement).closest('button, a, input, textarea, select')) return
  // Nothing to swipe between with zero or one exercise in the deck.
  if (workoutExerciseIds.value.length < 2) return
  dragStartX = event.clientX
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function handleWorkoutPointerUp(event: PointerEvent) {
  if (dragStartX === null) return
  const delta = event.clientX - dragStartX
  dragStartX = null
  const threshold = 40
  if (delta > threshold) goToPreviousExercise()
  else if (delta < -threshold) goToNextExercise()
}

// Add-exercise sheet: the deck's persistent "+". Candidates exclude whatever
// is already in the deck (picking one of those is what the dots are for).
const addingExercise = ref(false)

const candidateExercisesForSheet = computed(() =>
  exercises.activeExercises
    .filter((e) => !workoutExerciseIds.value.includes(e.id))
    .map((e) => ({ id: e.id, name: e.name })),
)

function openAddExercise() {
  addingExercise.value = true
}

function handleSheetSelect(id: string) {
  if (!workoutExerciseIds.value.includes(id)) adHocExerciseIds.value.push(id)
  selectExercise(id)
  addingExercise.value = false
}

function handleSheetManage() {
  addingExercise.value = false
  router.push({ name: 'exercises' })
}

// Recover-interrupted-workout item: recoverableWorkout comes straight off
// the raw fetch in stores/workouts.ts (checkForRecoverableWorkout), so its
// template name reads off the embedded `workout_templates` join rather than
// the templates store — that store may not have loaded yet by the time this
// prompt can appear (it's populated on boot, before WorkoutLogger's own
// onMounted has necessarily run).
const confirmingDiscardRecovered = ref(false)

const recoverableTemplateName = computed(
  () => workout.recoverableWorkout?.workout_templates?.name ?? 'Freeform workout',
)

const recoverableStartedLabel = computed(() => {
  if (!workout.recoverableWorkout) return ''
  return new Date(workout.recoverableWorkout.performed_at).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
})

async function handleResume() {
  const recovered = workout.recoverableWorkout
  if (!recovered) return
  workout.resumeRecoverableWorkout()
  notes.value = recovered.notes ?? ''
  templateId.value = recovered.template_id ?? ''
  adHocExerciseIds.value = []
  exerciseId.value = ''
  if (recovered.template_id) {
    await workout.fetchPreviousWorkout(recovered.template_id, recovered.id)
    if (!templates.exercisesByTemplate[recovered.template_id]) {
      await templates.fetchTemplateExercises(recovered.template_id)
    }
  }
  exerciseId.value = workoutExerciseIds.value[0] ?? ''
}

async function handleDiscardRecovered() {
  const { error } = await workout.discardRecoverableWorkout()
  if (error) {
    errorMessage.value = error.message
    return
  }
  confirmingDiscardRecovered.value = false
}

async function handleStart() {
  if (templateId.value === null) return
  errorMessage.value = ''
  // A brand-new workout session starts with no drafts of its own — without
  // this, a leftover unsaved row from a just-finished workout (e.g. the
  // auto-replenished blank row after the last set of a no-target exercise)
  // would resurface the moment the same exercise is picked again.
  draftRowsByExercise.value = {}
  adHocExerciseIds.value = []
  exerciseId.value = ''
  if (templateId.value) {
    await workout.fetchPreviousWorkout(templateId.value)
  }
  const { error } = await workout.startWorkout(notes.value || null, templateId.value || null)
  if (error) {
    errorMessage.value = error.message
    return
  }
  if (templateId.value && !templates.exercisesByTemplate[templateId.value]) {
    await templates.fetchTemplateExercises(templateId.value)
  }
  // Redesign item 67: the carousel opens on the deck's first exercise
  // (template order, or the first ad-hoc addition for a freeform workout)
  // instead of requiring an explicit pick before anything shows.
  exerciseId.value = workoutExerciseIds.value[0] ?? ''
}

// Backlog item 1: numbered rows matching the exercise's configured set
// count, instead of one field that gets overwritten set after set. Each
// exercise keeps its own row list, keyed by exercise id, so switching away
// and back preserves whatever's still unsaved in it — and because each
// exercise's rows only ever get touched by its own selection/completion
// code below (not by a broad "any set was added" watcher), a superset
// partner's slow-arriving response can no longer stomp on this exercise's
// draft the way the old single-field pre-fill could (see
// docs/backlog-archive.md for that history).
interface DraftRow {
  key: string
  reps: number | null
  weight: number | null
  rpe: number | null
  saving: boolean
  attempted: boolean
  error: string
}

function makeDraftRow(): DraftRow {
  return { key: crypto.randomUUID(), reps: null, weight: null, rpe: null, saving: false, attempted: false, error: '' }
}

// Shared across rows rather than per-row — a full-width unit selector on
// every row would eat most of the vertical space a compact grid is for.
const rowWeightUnit = ref<WeightUnit>('lb')

const draftRowsByExercise = ref<Record<string, DraftRow[]>>({})

function configuredTargetFor(id: string): number | null {
  if (!workout.activeTemplateId) return null
  return activeTemplateExercises.value.find((te) => te.exercise_id === id)?.target_sets ?? null
}

function loggedCountFor(id: string): number {
  return workout.activeSets.filter((s) => s.exercise_id === id).length
}

function setsLoggedLabel(id: string): string {
  const logged = loggedCountFor(id)
  const target = configuredTargetFor(id)
  const suffix = target !== null ? ` of ${target}` : ''
  const plural = logged === 1 && target === null ? '' : 's'
  return `${logged}${suffix} set${plural} logged`
}

// Position-indexed, same rule as the old applyPrefill: set N this session
// pre-fills from set N last time (not just "the last set logged"), since a
// superset's interleaved order would otherwise pre-fill from the wrong
// exercise's most recent set.
function applyPrefillToRow(row: DraftRow, id: string, position: number) {
  const matchingSet = previousSetsByExercise.value[id]?.[position]
  if (!matchingSet) {
    row.reps = null
    row.weight = null
    row.rpe = null
    return
  }
  row.reps = matchingSet.reps
  row.weight = matchingSet.weight
  row.rpe = matchingSet.rpe
}

// Lazily builds this exercise's row list the first time it's selected in
// the active workout: `target_sets` rows for a templated exercise (minus
// however many are already logged), or a single row if no count is
// configured. Later re-selections reuse whatever's already there instead of
// recomputing, so an in-progress but unsaved row survives switching to
// another exercise and back. Always seeds exactly one row for a no-target
// exercise regardless of loggedCount — in the normal continuous session this
// only ever runs at loggedCount 0 (completeRow's own auto-replenish handles
// every row after the first), but a resumed workout (recover-interrupted-
// workout item) can reach this on first selection with sets already logged
// last session, and still needs an open row to keep logging.
function ensureDraftRows(id: string) {
  if (draftRowsByExercise.value[id]) return
  const target = configuredTargetFor(id)
  const loggedCount = loggedCountFor(id)
  const plannedCount = target !== null ? Math.max(target - loggedCount, 0) : 1
  const rows = Array.from({ length: plannedCount }, () => makeDraftRow())
  rows.forEach((row, i) => applyPrefillToRow(row, id, loggedCount + i))
  const seedUnit = previousSetsByExercise.value[id]?.[loggedCount]?.weight_unit
  if (seedUnit) rowWeightUnit.value = seedUnit
  draftRowsByExercise.value[id] = rows
}

const draftRows = computed(() => (exerciseId.value ? (draftRowsByExercise.value[exerciseId.value] ?? []) : []))

// Redesign item: tapping into a reps/weight/RPE field that already carries
// a value (a stepper adjustment, or pre-fill/carryover from the previous
// set) used to require manually repositioning the cursor before typing.
// Selecting the value on focus makes it a one-keystroke overwrite instead.
function selectInputText(event: FocusEvent) {
  ;(event.target as HTMLInputElement).select()
}

// Backlog item 1: the numbered grid shows every row for the selected
// exercise together — already-logged sets in a compact read-only form (edit
// and delete stay on the full workout list below, so there's one place that
// owns that state, not two) followed by the still-open draft rows.
type CombinedRow =
  | { type: 'logged'; number: number; set: SetEntry }
  | { type: 'draft'; number: number; row: DraftRow }

const combinedRows = computed<CombinedRow[]>(() => {
  if (!exerciseId.value) return []
  const id = exerciseId.value
  const logged = workout.activeSets.filter((s) => s.exercise_id === id)
  const rows: CombinedRow[] = logged.map((set, i) => ({ type: 'logged', number: i + 1, set }))
  draftRows.value.forEach((row, i) => rows.push({ type: 'draft', number: logged.length + i + 1, row }))
  return rows
})

watch(exerciseId, (id) => {
  if (!id) return
  ensureDraftRows(id)
})

// Backlog item 1: "allow more to be added" — a manual escape hatch for both
// directions (a templated exercise the user wants to over/under-run this
// time, or another round for a no-target exercise beyond its auto-replenish
// below).
function addDraftRow(id: string) {
  const rows = draftRowsByExercise.value[id] ?? (draftRowsByExercise.value[id] = [])
  const row = makeDraftRow()
  applyPrefillToRow(row, id, loggedCountFor(id) + rows.length)
  rows.push(row)
}

function removeDraftRow(id: string, row: DraftRow) {
  if (row.saving || row.error) return
  const rows = draftRowsByExercise.value[id]
  if (!rows) return
  const index = rows.indexOf(row)
  if (index !== -1) rows.splice(index, 1)
}

// Backlog item 28: the in-app rest screen (RestTimer.vue) shows the
// countdown/progress bar/skip option while the tab stays foregrounded. Item
// 15's push notification is the fallback for whenever the tab actually goes
// to the background *during* the rest period — not just a check at the
// moment the set is logged (found 2026-09-24 in device testing: logging a
// set is itself done in the foreground, so an add-time-only check on
// document.hidden always picked the in-app path, and locking the phone or
// switching apps mid-rest then suspends that screen's setInterval with
// nothing having been sent as a fallback — silence on both counts). Tracked
// by end time (not remaining seconds) so both this screen and the
// visibility handler below compute the same "time left" independent of how
// long since the rest actually started.
const activeRest = ref<{ exerciseName: string; endsAt: number; totalSeconds: number } | null>(null)
let restPushSent = false

// Fires once per rest period, the first time the tab actually goes hidden
// while one is active — locking the screen or switching apps counts, same
// as backgrounding a browser tab.
function handleRestVisibilityChange() {
  if (!document.hidden || !activeRest.value || restPushSent) return
  restPushSent = true
  const remaining = Math.max(1, Math.round((activeRest.value.endsAt - Date.now()) / 1000))
  push.sendRestReminder(activeRest.value.exerciseName, remaining)
}

// Backlog item 52: "Back to workout" lets the user return to logging while
// rest keeps counting down in the background, instead of "Skip Rest" being
// the only way off the full-screen overlay. RestTimer.vue only runs its own
// completion check while mounted, so while minimized this component takes
// over ticking activeRest.endsAt itself (same completion behavior: vibrate,
// then clear) — otherwise a rest period completing while minimized would
// never end.
const restMinimized = ref(false)
const restMiniRemaining = ref(0)
let miniRestInterval: ReturnType<typeof setInterval> | undefined

function tickMiniRest() {
  if (!activeRest.value) return
  const remaining = Math.max(0, Math.round((activeRest.value.endsAt - Date.now()) / 1000))
  restMiniRemaining.value = remaining
  if (remaining <= 0) finishRest()
}

watch(restMinimized, (minimized) => {
  clearInterval(miniRestInterval)
  if (minimized && activeRest.value) {
    tickMiniRest()
    miniRestInterval = setInterval(tickMiniRest, 250)
  }
})

const restMiniLabel = computed(() => {
  const m = Math.floor(restMiniRemaining.value / 60)
  const s = restMiniRemaining.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

function finishRest() {
  navigator.vibrate?.(200)
  activeRest.value = null
  restMinimized.value = false
}

function skipRest() {
  activeRest.value = null
  restMinimized.value = false
}

// ±15s manual adjustment (item 52). Shrinking never rescales the progress
// bar's denominator (a shortened rest just fills faster); growing extends
// `totalSeconds` only when the new remaining time would otherwise exceed
// it, so the bar never reports past 100%.
function adjustRest(deltaSeconds: number) {
  if (!activeRest.value) return
  const currentRemaining = Math.round((activeRest.value.endsAt - Date.now()) / 1000)
  const newRemaining = Math.max(0, currentRemaining + deltaSeconds)
  activeRest.value = {
    ...activeRest.value,
    endsAt: Date.now() + newRemaining * 1000,
    totalSeconds: Math.max(activeRest.value.totalSeconds, newRemaining),
  }
}

// RPE is optional, so its input has no `required` guard forcing reps/weight
// to a real value before submit — v-model.number leaves an emptied field as
// '' rather than coercing it to null, and that '' sent straight through to
// Postgres's numeric rpe column is what throws "invalid input syntax for
// type numeric".
function normalizeRpe(value: number | null): number | null {
  return (value as unknown) === '' ? null : value
}

function startRestIfConfigured(id: string) {
  const restSeconds = exercises.exercises.find((e) => e.id === id)?.rest_seconds
  if (!restSeconds) return
  restPushSent = false
  restMinimized.value = false
  activeRest.value = {
    exerciseName: exerciseName(id),
    endsAt: Date.now() + restSeconds * 1000,
    totalSeconds: restSeconds,
  }
  // Covers the rare case where the set is logged while already
  // backgrounded (e.g. a delayed background response) — nothing will
  // ever see the in-app screen, so send the fallback immediately instead
  // of waiting on a visibilitychange that already happened.
  handleRestVisibilityChange()
}

// Backlog item 1: completing one row saves just that set — the other rows
// stay put, editable, and independently completable (including while rest
// for this one is running). `row.saving` disables only this row's own
// button for the duration of its request, same reasoning item 11 originally
// used for the single "Add set" button: without it, two taps on the same
// row could race over the network and land in the opposite order from how
// they were tapped.
async function completeRow(id: string, row: DraftRow) {
  if (row.reps === null || row.weight === null || row.saving) return
  row.saving = true
  row.error = ''
  const retry = row.attempted
  row.attempted = true
  const { error, reconciled } = await workout.addSet(
    id, row.reps, row.weight, rowWeightUnit.value, normalizeRpe(row.rpe), row.key, retry
  )
  row.saving = false
  if (error) {
    row.error = 'Set not confirmed. Check your connection, then retry. Your entries are still here.'
    return
  }

  const rows = draftRowsByExercise.value[id] ?? []
  const index = rows.indexOf(row)
  if (index !== -1) rows.splice(index, 1)

  // No configured count means an open-ended exercise — keep exactly one
  // open row available so logging stays a quick, repeated tap instead of
  // requiring "+ Add row" after every single set. A configured target_sets
  // stays fixed at that count instead; over/under-running it is what the
  // manual add/remove controls are for.
  if (configuredTargetFor(id) === null) {
    const nextRow = makeDraftRow()
    applyPrefillToRow(nextRow, id, loggedCountFor(id) + rows.length)
    rows.push(nextRow)
  }

  // A reconciled set was saved earlier, so a new full rest period would be
  // misleading. The saved row is visible and can be corrected with Edit.
  if (!reconciled) startRestIfConfigured(id)
}

// Backlog item 13: inline edit for a set still in the active workout, same
// pattern as ExerciseList.vue's name/notes editors — one row's id tracked
// here, null means no row is being edited.
const editingSetId = ref<string | null>(null)
const editReps = ref<number | null>(null)
const editWeight = ref<number | null>(null)
const editWeightUnit = ref<WeightUnit>('lb')
const editRpe = ref<number | null>(null)

function startEditingSet(set: SetEntry) {
  editingSetId.value = set.id
  editReps.value = set.reps
  editWeight.value = set.weight
  editWeightUnit.value = set.weight_unit
  editRpe.value = set.rpe
}

async function saveSetEdit(id: string) {
  errorMessage.value = ''
  if (editReps.value === null || editWeight.value === null) return
  const { error } = await workout.updateSet(
    id,
    editReps.value,
    editWeight.value,
    editWeightUnit.value,
    normalizeRpe(editRpe.value),
  )
  if (error) {
    errorMessage.value = error.message
  } else {
    editingSetId.value = null
  }
}

// Backlog item 51: same inline confirm pattern as WorkoutHistory.vue's
// whole-workout delete — a logged set has no undo, so deleting it shouldn't
// be a single accidental tap.
const confirmingDeleteSetId = ref<string | null>(null)

async function handleDeleteSet(id: string) {
  errorMessage.value = ''
  if (editingSetId.value === id) editingSetId.value = null
  confirmingDeleteSetId.value = null
  const { error } = await workout.deleteSet(id)
  if (error) errorMessage.value = error.message
}

function exerciseName(id: string): string {
  return exercises.exercises.find((e) => e.id === id)?.name ?? 'Unknown'
}

// Backlog item 8: surface setup notes (machine seat height, etc.) right
// where a set gets logged, not just in the Exercises tab.
const selectedExerciseNotes = computed(() => {
  if (!exerciseId.value) return null
  return exercises.exercises.find((e) => e.id === exerciseId.value)?.setup_notes ?? null
})

// Backlog item 1: id of the exercise whose history overlay is open, opened
// from right where a set gets logged (same idea as selectedExerciseNotes
// above) rather than requiring a trip to the Exercises tab mid-workout.
const viewingHistoryFor = ref<string | null>(null)

// Backlog item 6: post-workout volume-over-time chart. Captured before
// finishWorkout() clears activeTemplateId/activeSets — a freeform workout
// (no template) or a workout finished with zero sets logged (deleted by
// finishWorkout, see item 9) has nothing to chart.
const showingVolumeChart = ref(false)

// Backlog item 51: finishWorkout() silently deletes the workout row when no
// sets were logged (see finishWorkout in stores/workouts.ts) — confirm
// before that happens rather than letting a stray "Finish workout" tap
// discard the session with no feedback.
const confirmingEmptyFinish = ref(false)
const hasUnconfirmedSet = computed(() => Object.values(draftRowsByExercise.value)
  .some((rows) => rows.some((row) => row.saving || !!row.error)))

function handleFinishClick() {
  if (hasUnconfirmedSet.value) return
  if (workout.activeSets.length === 0 && !confirmingEmptyFinish.value) {
    confirmingEmptyFinish.value = true
    return
  }
  handleFinish()
}

async function handleFinish() {
  if (hasUnconfirmedSet.value) return
  const finishedTemplateId = workout.activeTemplateId
  const hadSets = workout.activeSets.length > 0

  await workout.finishWorkout()
  confirmingEmptyFinish.value = false
  notes.value = ''
  templateId.value = null
  exerciseId.value = ''
  draftRowsByExercise.value = {}
  adHocExerciseIds.value = []
  recordCelebration.value = null

  // Resume-after-finish item: fetch the offer's data up front (rather than
  // lazily on tap) so the "Resume workout?" card can show the template name
  // and set count immediately once it's reached, whether that's right away
  // (freeform) or after the volume chart is dismissed (templated). This has
  // to finish before showingVolumeChart flips true, not just before
  // handleFinish returns — otherwise the fetch can still be in flight when
  // the volume chart's own dismiss button is clicked, and its late arrival
  // switches the just-shown home screen straight to the resume card mid-
  // interaction (surfaced as a flaky "element was detached from the DOM"
  // failure on the next click in template-or-freeform-choice.spec.ts).
  if (hadSets) await workout.fetchJustFinishedWorkout()

  if (finishedTemplateId && hadSets) {
    const templateExercises = templates.exercisesByTemplate[finishedTemplateId] ?? []
    await workout.fetchTemplateVolumeHistory(finishedTemplateId, templateExercises)
    showingVolumeChart.value = true
  }
  workout.fetchProgressStats()
}

function dismissVolumeChart() {
  showingVolumeChart.value = false
  workout.clearVolumeHistory()
}

// Resume-after-finish item: mirrors handleResume above, but restores from
// justFinishedWorkout (the workout finishWorkout() just completed) instead
// of a crash-recovered one.
const justFinishedTemplateName = computed(
  () => workout.justFinishedWorkout?.workout_templates?.name ?? 'Freeform workout',
)

async function handleResumeJustFinished() {
  const justFinished = workout.justFinishedWorkout
  if (!justFinished) return
  workout.resumeJustFinishedWorkout()
  notes.value = justFinished.notes ?? ''
  templateId.value = justFinished.template_id ?? ''
  adHocExerciseIds.value = []
  exerciseId.value = ''
  if (justFinished.template_id) {
    await workout.fetchPreviousWorkout(justFinished.template_id, justFinished.id)
    if (!templates.exercisesByTemplate[justFinished.template_id]) {
      await templates.fetchTemplateExercises(justFinished.template_id)
    }
  }
  exerciseId.value = workoutExerciseIds.value[0] ?? ''
}
</script>

<template>
  <div>
    <div class="log-header">
      <h2>{{ headerTitle }}</h2>
      <span v-if="elapsedLabel" class="elapsed-time" aria-label="Time since workout started">{{ elapsedLabel }}</span>
    </div>

    <div v-if="workout.recoverableWorkout" class="card">
      <h3>Resume your workout?</h3>
      <p class="row-sub">
        {{ recoverableTemplateName }} · started {{ recoverableStartedLabel }}
        <template v-if="workout.recoverableWorkout.sets.length > 0">
          · {{ workout.recoverableWorkout.sets.length }} set{{ workout.recoverableWorkout.sets.length === 1 ? '' : 's' }} logged
        </template>
      </p>
      <div v-if="!confirmingDiscardRecovered" class="confirm-actions">
        <button type="button" class="btn-accent" @click="handleResume">Resume workout</button>
        <button type="button" class="ghost" @click="confirmingDiscardRecovered = true">Discard workout</button>
      </div>
      <div v-else class="confirm-delete">
        <span class="row-sub">
          Discard this workout{{ workout.recoverableWorkout.sets.length > 0 ? ' and its logged sets' : '' }}? This can't be undone.
        </span>
        <div class="confirm-actions">
          <button type="button" class="danger small" @click="handleDiscardRecovered">Discard workout</button>
          <button type="button" class="ghost small" @click="confirmingDiscardRecovered = false">Cancel</button>
        </div>
      </div>
    </div>

    <template v-else>
    <div v-if="showingVolumeChart" class="card">
      <h3>Volume over time</h3>
      <VolumeChart :points="workout.volumeHistory" />
      <button type="button" class="btn-accent finish chart-dismiss" @click="dismissVolumeChart">Log another workout</button>
    </div>

    <div v-else-if="workout.justFinishedWorkout" class="card">
      <h3>Resume your workout?</h3>
      <p class="row-sub">
        Just finished · {{ justFinishedTemplateName }}
        · {{ workout.justFinishedWorkout.sets.length }} set{{ workout.justFinishedWorkout.sets.length === 1 ? '' : 's' }} logged
      </p>
      <div class="confirm-actions">
        <button type="button" class="btn-accent" @click="handleResumeJustFinished">Resume workout</button>
        <button type="button" class="ghost" @click="workout.dismissJustFinishedWorkout()">Start a new workout</button>
      </div>
    </div>

    <template v-else-if="!workout.activeWorkoutId">
      <template v-if="!exercises.loading">
        <div v-if="exercises.activeExercises.length > 0" class="progress-strip">
          <div class="stat-tile stat-tile-week">
            <span class="stat-eyebrow">This week</span>
            <div class="stat-value-row">
              <span class="stat-value">{{ workout.workoutsThisWeek }}</span>
              <span class="stat-value-unit">{{ workout.workoutsThisWeek === 1 ? 'workout' : 'workouts' }}</span>
            </div>
            <div class="paw-tracker">
              <span
                v-for="(done, day) in workout.workoutDaysThisWeek"
                :key="day"
                class="paw-day"
                :class="{ 'paw-day-done': done }"
                :aria-label="`${weekdayNames[day]}: ${done ? 'workout logged' : 'no workout logged'}`"
              >
                <svg v-if="done" class="paw-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <ellipse cx="12" cy="16" rx="5.5" ry="4.2" />
                  <ellipse cx="6" cy="9" rx="2.1" ry="2.6" />
                  <ellipse cx="11" cy="6.5" rx="2.1" ry="2.6" />
                  <ellipse cx="16.2" cy="7.5" rx="2" ry="2.5" />
                  <ellipse cx="19" cy="11.5" rx="1.8" ry="2.3" />
                </svg>
              </span>
            </div>
          </div>
          <div v-if="workout.recentPr" class="stat-tile stat-tile-pr">
            <span class="pr-badge">NEW</span>
            <span class="stat-value">Volume PR!</span>
            <span class="stat-label">{{ workout.recentPr.exerciseName }}</span>
            <span class="pr-detail">{{ workout.recentPr.reps }} × {{ workout.recentPr.weight }}{{ workout.recentPr.weightUnit }}</span>
          </div>
        </div>

        <div v-if="exercises.activeExercises.length === 0" class="welcome-wrap">
          <div class="card welcome-card">
            <div class="mascot mascot-lg">
              <img src="/icon-512.png" alt="" />
            </div>
            <p class="welcome-title">Welcome to RepBunny</p>
            <p class="welcome-copy">
              This is where your workouts live. Add your first exercise to start logging sets and watching your
              progress build.
            </p>
            <button type="button" class="welcome-cta" @click="router.push({ name: 'exercises' })">
              Add your first exercise
            </button>
          </div>
        </div>

        <template v-else>
          <div v-if="templates.activeTemplates.length === 0" class="card template-hint">
            <div class="mascot mascot-sm">
              <img src="/icon-512.png" alt="" />
            </div>
            <p class="template-hint-copy">
              Nice, you're ready to log. Templates help you repeat a workout and track its progress over time.
              <button type="button" class="link-button" @click="router.push({ name: 'templates' })">
                Create a template
              </button>
            </p>
          </div>

          <form class="card" @submit.prevent="handleStart">
            <label id="workout-template-label">Template (optional)</label>
            <div class="template-chips" role="group" aria-labelledby="workout-template-label">
              <button
                type="button"
                class="chip template-chip"
                :class="{ 'chip-selected': templateId === '' }"
                @click="templateId = ''"
              >
                Freeform
              </button>
              <button
                v-for="template in templates.activeTemplates"
                :key="template.id"
                type="button"
                class="chip template-chip"
                :class="{ 'chip-selected': templateId === template.id }"
                @click="templateId = template.id"
              >
                {{ template.name }}
              </button>
              <button type="button" class="chip template-chip template-chip-new" @click="router.push({ name: 'templates' })">
                + New
              </button>
            </div>

            <label for="workout-notes">Notes (optional)</label>
            <input id="workout-notes" v-model="notes" type="text" />
            <button type="submit" :disabled="templateId === null">Start workout</button>
          </form>
        </template>
      </template>
    </template>

    <div v-else class="active-workout-screen" @pointerdown="handleWorkoutPointerDown" @pointerup="handleWorkoutPointerUp">
      <p v-if="exercises.activeExercises.length === 0" class="empty">
        No exercises yet. Add one under the Exercises tab first.
      </p>

      <template v-else>
        <div class="exercise-deck">
          <div class="deck-controls">
            <div v-if="workoutExerciseIds.length > 0" class="deck-dots" role="group" aria-label="Exercises in this workout">
              <button
                v-for="id in workoutExerciseIds"
                :key="id"
                type="button"
                class="deck-dot"
                :class="{ 'deck-dot-active': id === exerciseId }"
                :aria-label="exerciseName(id)"
                :aria-pressed="id === exerciseId"
                @click="selectExercise(id)"
              ></button>
            </div>
            <span v-else class="deck-dots-spacer"></span>
            <button type="button" class="deck-add-btn" aria-label="Add exercise" @click="openAddExercise">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            </button>
          </div>

          <div v-if="workoutExerciseIds.length > 0" class="deck-peek-row">
            <button
              type="button"
              class="deck-peek"
              aria-label="Previous exercise"
              :disabled="currentExerciseIndex <= 0"
              @click="goToPreviousExercise"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            <div class="exercise-card-viewport">
              <Transition :name="slideDirection >= 0 ? 'slide-next' : 'slide-prev'" mode="out-in">
                <div :key="exerciseId" class="exercise-card">
                  <span class="exercise-card-position">{{ currentExerciseIndex + 1 }} / {{ workoutExerciseIds.length }}</span>
                  <div class="exercise-card-name">{{ exerciseName(exerciseId) }}</div>
                  <p v-if="selectedExerciseNotes" class="setup-notes exercise-card-notes">{{ selectedExerciseNotes }}</p>
                  <div class="exercise-card-footer">
                    <span class="row-sub">{{ setsLoggedLabel(exerciseId) }}</span>
                    <button type="button" class="link-button history-link" @click="viewingHistoryFor = exerciseId">
                      View exercise history
                    </button>
                  </div>
                </div>
              </Transition>
            </div>

            <button
              type="button"
              class="deck-peek"
              aria-label="Next exercise"
              :disabled="currentExerciseIndex >= workoutExerciseIds.length - 1"
              @click="goToNextExercise"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>

          <div v-else class="card deck-empty">
            <p class="row-sub">No exercises yet. Add one to start logging.</p>
            <button type="button" class="btn-accent" @click="openAddExercise">Add your first exercise</button>
          </div>
        </div>

        <div v-if="exerciseId" class="card">
          <div class="set-header-row">
            <span class="set-header-number" aria-hidden="true">Set</span>
            <span class="set-header-weight">
              <span aria-hidden="true">Weight</span>
              <span class="unit-toggle" role="group" aria-label="Units">
                <button
                  type="button"
                  class="unit-btn"
                  :class="{ 'unit-selected': rowWeightUnit === 'lb' }"
                  :aria-pressed="rowWeightUnit === 'lb'"
                  @click="rowWeightUnit = 'lb'"
                >
                  lb
                </button>
                <button
                  type="button"
                  class="unit-btn"
                  :class="{ 'unit-selected': rowWeightUnit === 'kg' }"
                  :aria-pressed="rowWeightUnit === 'kg'"
                  @click="rowWeightUnit = 'kg'"
                >
                  kg
                </button>
              </span>
            </span>
            <span class="set-header-reps" aria-hidden="true">Reps</span>
            <span class="set-header-rpe" aria-hidden="true">RPE</span>
            <span class="set-header-spacer" aria-hidden="true"></span>
          </div>

          <div class="set-rows-viewport">
          <div ref="setRowsPanelEl" class="set-rows-panel">
          <ul class="set-rows">
            <li
              v-for="entry in combinedRows"
              :key="entry.type === 'logged' ? entry.set.id : entry.row.key"
              class="set-row"
              :class="entry.type === 'logged' ? 'set-row-logged' : 'set-row-draft'"
            >
              <span class="set-row-number" aria-hidden="true">{{ entry.number }}</span>

              <span v-if="entry.type === 'logged'" class="set-row-done">
                {{ entry.set.reps }} × {{ entry.set.weight }}{{ entry.set.weight_unit }}
                <template v-if="entry.set.rpe !== null"> · RPE {{ entry.set.rpe }}</template>
              </span>

              <template v-else>
                <div class="set-row-body">
                <div class="set-row-line">
                  <label class="set-field set-field-weight">
                    <span class="sr-only">Weight</span>
                    <input
                      :id="`row-weight-${entry.row.key}`"
                      v-model.number="entry.row.weight"
                      :disabled="entry.row.saving"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.5"
                      placeholder="0"
                      class="set-input-compact"
                      @focus="selectInputText"
                    />
                    <span class="set-field-unit" aria-hidden="true">{{ rowWeightUnit }}</span>
                  </label>
                  <label class="set-field set-field-reps">
                    <span class="sr-only">Reps</span>
                    <input
                      :id="`row-reps-${entry.row.key}`"
                      v-model.number="entry.row.reps"
                      :disabled="entry.row.saving"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      placeholder="0"
                      class="set-input-compact"
                      @focus="selectInputText"
                    />
                  </label>
                  <label class="set-field set-field-rpe">
                    <span class="sr-only">RPE (optional)</span>
                    <input
                      :id="`row-rpe-${entry.row.key}`"
                      v-model.number="entry.row.rpe"
                      :disabled="entry.row.saving"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      max="10"
                      step="0.5"
                      placeholder="–"
                      class="set-input-compact set-input-rpe-compact"
                      @focus="selectInputText"
                    />
                  </label>
                  <span class="set-row-actions-compact">
                    <button
                      type="button"
                      class="remove-row-btn-compact"
                      :aria-label="`Remove row ${entry.number}`"
                      :disabled="entry.row.saving || !!entry.row.error"
                      @click="removeDraftRow(exerciseId, entry.row)"
                    >
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
                    </button>
                    <button
                      type="button"
                      class="log-btn-compact"
                      :class="{ 'log-btn-compact-retry': entry.row.error }"
                      :aria-label="entry.row.saving ? 'Saving…' : entry.row.error ? 'Retry' : 'Add set'"
                      :disabled="entry.row.reps === null || entry.row.weight === null || entry.row.saving"
                      @click="completeRow(exerciseId, entry.row)"
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    </button>
                  </span>
                </div>
                <p v-if="entry.row.error" class="row-error">{{ entry.row.error }}</p>
                </div>
              </template>
            </li>
          </ul>

          <button type="button" class="add-row-btn" @click="addDraftRow(exerciseId)">+ Add row</button>
          </div>
          </div>
        </div>
      </template>

      <ol class="list">
        <li v-for="(set, index) in workout.activeSets" :key="set.id" class="row-wrap">
          <div class="row">
            <span class="row-index">{{ index + 1 }}</span>
            <span class="row-body">
              <span class="row-title">{{ exerciseName(set.exercise_id) }}</span>
              <span class="row-sub">
                {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
                <template v-if="set.rpe !== null"> · RPE {{ set.rpe }}</template>
              </span>
            </span>
            <div class="row-actions">
              <button type="button" class="ghost small" @click="startEditingSet(set)">Edit</button>
              <button type="button" class="ghost small" @click="confirmingDeleteSetId = set.id">Delete</button>
            </div>
          </div>

          <div v-if="confirmingDeleteSetId === set.id" class="confirm-delete">
            <span class="row-sub">Delete this set? This can't be undone.</span>
            <div class="confirm-actions">
              <button type="button" class="danger small" @click="handleDeleteSet(set.id)">Confirm delete</button>
              <button type="button" class="ghost small" @click="confirmingDeleteSetId = null">Cancel</button>
            </div>
          </div>

          <form v-if="editingSetId === set.id" class="set-edit-form" @submit.prevent="saveSetEdit(set.id)">
            <div class="grid-2">
              <div>
                <label :for="`edit-reps-${set.id}`">Reps</label>
                <input
                  :id="`edit-reps-${set.id}`"
                  v-model.number="editReps"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  required
                />
              </div>
              <div>
                <label :for="`edit-weight-${set.id}`">Weight</label>
                <input
                  :id="`edit-weight-${set.id}`"
                  v-model.number="editWeight"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  step="0.5"
                  required
                />
              </div>
            </div>
            <div class="grid-2">
              <div>
                <label :for="`edit-unit-${set.id}`">Unit</label>
                <select :id="`edit-unit-${set.id}`" v-model="editWeightUnit">
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <div>
                <label :for="`edit-rpe-${set.id}`">RPE (optional)</label>
                <input
                  :id="`edit-rpe-${set.id}`"
                  v-model.number="editRpe"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="10"
                  step="0.5"
                />
              </div>
            </div>
            <div class="set-edit-actions">
              <button type="submit">Save</button>
              <button type="button" class="ghost small" @click="editingSetId = null">Cancel</button>
            </div>
          </form>
        </li>
      </ol>

      <div v-if="confirmingEmptyFinish" class="confirm-delete">
        <span class="row-sub">Finish with no sets logged? This will discard the workout.</span>
        <div class="confirm-actions">
          <button type="button" class="danger small" @click="handleFinish">Discard workout</button>
          <button type="button" class="ghost small" @click="confirmingEmptyFinish = false">Cancel</button>
        </div>
      </div>
      <button v-else type="button" class="btn-accent finish" :disabled="hasUnconfirmedSet" @click="handleFinishClick">Finish workout</button>
      <p v-if="hasUnconfirmedSet" class="row-error">Retry the unconfirmed set before finishing.</p>
    </div>
    </template>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <RecordCelebration
      v-if="recordCelebration"
      :exercise-name="exerciseName(recordCelebration.exerciseId)"
      :reps="recordCelebration.reps"
      :weight="recordCelebration.weight"
      :weight-unit="recordCelebration.weightUnit"
      :previous-best="recordCelebration.previousBest"
      @dismiss="recordCelebration = null"
    />

    <RestTimer
      v-if="activeRest && !restMinimized"
      :exercise-name="activeRest.exerciseName"
      :ends-at="activeRest.endsAt"
      :total-seconds="activeRest.totalSeconds"
      @dismiss="skipRest"
      @minimize="restMinimized = true"
      @adjust="adjustRest"
    />

    <ExerciseHistoryDetail
      v-if="viewingHistoryFor"
      :exercise-id="viewingHistoryFor"
      @dismiss="viewingHistoryFor = null"
    />

    <AddExerciseSheet
      v-if="addingExercise"
      :exercises="candidateExercisesForSheet"
      :recent-ids="workout.recentlyLoggedExerciseIds"
      @select="handleSheetSelect"
      @dismiss="addingExercise = false"
      @manage="handleSheetManage"
    />

    <div v-if="activeRest && restMinimized" class="rest-mini-bar" role="status" aria-live="polite">
      <span class="rest-mini-label">Resting {{ restMiniLabel }} - {{ activeRest.exerciseName }}</span>
      <div class="rest-mini-actions">
        <button type="button" class="rest-mini-resume" @click="restMinimized = false">Resume</button>
        <button type="button" class="rest-mini-skip" @click="skipRest">Skip</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.rest-mini-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: calc(64px + env(safe-area-inset-bottom, 0px));
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  max-width: 480px;
  margin: 0 auto;
  padding: 10px 16px;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
}

.rest-mini-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rest-mini-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.rest-mini-resume {
  background: var(--accent);
  color: var(--bg);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
}

.rest-mini-skip {
  background: var(--surface);
  padding: 6px 14px;
  border-radius: 999px;
  font-size: 0.8rem;
}

.log-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

/* Redesign item 67 follow-up: the carousel's swipe gesture is bound here
   (handleWorkoutPointerDown/Up in the script) rather than just on the
   exercise card, so a drag starting anywhere over the set rows, notes, etc.
   still moves the carousel -- not just one confined to the small card.
   `touch-action: pan-y` keeps a vertical drag scrolling the page normally
   while stopping the browser from treating a horizontal one as its own
   scroll/navigation gesture before the pointer handlers see it. */
.active-workout-screen {
  touch-action: pan-y;
  -webkit-user-select: none;
  user-select: none;
}

.elapsed-time {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.progress-strip {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.stat-tile {
  flex: 1;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.stat-value {
  font-size: 1.4rem;
  font-weight: 700;
}

.stat-label {
  font-size: 0.75rem;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat-eyebrow {
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.stat-value-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.stat-tile-week .stat-value {
  font-family: var(--font-display);
}

.stat-value-unit {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--text-dim);
}

.paw-tracker {
  display: flex;
  gap: 5px;
  margin-top: 10px;
}

.paw-day {
  width: 15px;
  height: 15px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.paw-day-done {
  background: none;
}

.paw-icon {
  width: 15px;
  height: 15px;
  fill: var(--accent);
}

.stat-tile-pr {
  position: relative;
  background: color-mix(in srgb, var(--success) 14%, transparent);
  border-color: color-mix(in srgb, var(--success) 30%, transparent);
  padding-top: 16px;
}

.stat-tile-pr .stat-value {
  font-family: var(--font-display);
  font-size: 1rem;
  color: var(--success);
}

.stat-tile-pr .stat-label {
  color: var(--text);
  white-space: normal;
}

.pr-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--highlight) 22%, transparent);
  color: var(--highlight);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.3px;
}

.pr-detail {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--success) 55%, var(--text));
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 20px;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.welcome-wrap {
  position: relative;
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.welcome-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 320px;
  padding: 32px 26px;
  text-align: center;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
  margin-bottom: 0;
}

.mascot {
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.mascot-lg {
  width: 88px;
  height: 88px;
}

.mascot-lg img {
  width: 60px;
  height: 60px;
  border-radius: 12px;
}

.mascot-sm {
  width: 40px;
  height: 40px;
}

.mascot-sm img {
  width: 28px;
  height: 28px;
  border-radius: 6px;
}

.welcome-title {
  margin: 0;
  font-size: 1.35rem;
  font-weight: 700;
  color: var(--text);
}

.welcome-copy {
  margin: 0;
  font-size: 0.95rem;
  line-height: 1.55;
}

.welcome-cta {
  width: 100%;
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--accent-text);
  font-weight: 600;
  font-size: 0.95rem;
}

.template-hint {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.template-hint-copy {
  margin: 0;
  font-size: 0.9rem;
  line-height: 1.5;
}

.link-button {
  display: inline;
  min-height: auto;
  padding: 0;
  border: none;
  background: none;
  color: var(--accent);
  font: inherit;
  text-decoration: underline;
}

.history-link {
  display: block;
  margin: 4px 0 0;
  font-size: 0.85rem;
}

.empty {
  text-align: center;
  padding: 24px 0;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.row-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
}

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: space-between;
  flex-wrap: wrap;
}

.row-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 0.75rem;
}

.row-body {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.set-edit-form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.set-edit-actions {
  display: flex;
  gap: 8px;
}

.confirm-delete {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
}

.ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
}

.danger {
  background: var(--danger);
  border-color: var(--danger);
  color: white;
}

.danger.small {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.ghost.small {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.chip {
  min-height: 36px;
  padding: 0 14px;
  font-size: 0.85rem;
  font-weight: 500;
}

.chip.chip-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}

.template-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 14px;
}

.template-chip {
  flex-shrink: 0;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  font-weight: 600;
}

.template-chip.chip-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 800;
}

.template-chip-new {
  border-style: dashed;
}

.finish {
  width: 100%;
}

.chart-dismiss {
  margin-top: 16px;
}

.error {
  color: var(--danger);
}

.setup-notes {
  display: flex;
  align-items: center;
  min-height: 48px;
  font-size: 0.8rem;
  color: var(--text-dim);
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 8px 10px;
  margin: 8px 0 4px;
  white-space: pre-wrap;
}

/* Redesign item 67: swipeable exercise carousel replacing the suggested-chip
   row and the exercise <select>. Dots pick an exercise directly; the peek
   buttons step one at a time; the card itself also responds to a
   left/right drag via pointer events (handlePointerDown/Up in the script). */
.exercise-deck {
  margin-bottom: 20px;
}

.deck-controls {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 16px 12px;
}

.deck-dots {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-wrap: wrap;
  justify-content: center;
}

.deck-dots-spacer {
  display: block;
  height: 6px;
}

.deck-dot {
  width: 6px;
  height: 6px;
  padding: 0;
  min-height: 0;
  border-radius: 3px;
  background: var(--border);
  border: none;
  transition: width 0.15s ease, background-color 0.15s ease;
}

.deck-dot-active {
  width: 20px;
  background: var(--accent);
}

.deck-add-btn {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
  background: none;
  border: 1px dashed var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.deck-peek-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.deck-peek {
  flex-shrink: 0;
  width: 26px;
  height: 150px;
  min-height: 0;
  padding: 0;
  border-radius: 16px;
  background: var(--surface-2);
  border: none;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.deck-peek:disabled {
  opacity: 0.35;
}

/* Clips the slide transition below to the card's rounded corners, and gives
   the transition's absolutely-unnecessary-but-simpler out-in swap a fixed
   box to happen inside instead of the surrounding flex row reflowing. */
.exercise-card-viewport {
  flex: 1;
  min-width: 0;
  height: 150px;
  border-radius: 18px;
  overflow: hidden;
}

.exercise-card {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 18px;
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

/* Redesign item 67 follow-up: swiping/tapping a dot used to swap the
   exercise card's content instantly, easy to miss as "nothing happened" at
   a glance. Slides the new exercise in from the direction it came from
   (slideDirection in the script), fading the old one out first (`out-in`
   so the two never overlap and fight for the same box). */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active {
  transition: transform 0.18s ease, opacity 0.18s ease;
}

.slide-next-enter-from {
  transform: translateX(28px);
  opacity: 0;
}

.slide-next-leave-to {
  transform: translateX(-28px);
  opacity: 0;
}

.slide-prev-enter-from {
  transform: translateX(-28px);
  opacity: 0;
}

.slide-prev-leave-to {
  transform: translateX(28px);
  opacity: 0;
}

.exercise-card-position {
  align-self: flex-start;
  padding: 2px 9px;
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 0.68rem;
  font-weight: 800;
}

.exercise-card-name {
  font-family: var(--font-display, inherit);
  font-size: 1.25rem;
  font-weight: 800;
  line-height: 1.1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.exercise-card-notes {
  min-height: 0;
  margin: 2px 0;
}

.exercise-card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.deck-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Redesign item 67 follow-up: column headers (Set/Weight/Reps/RPE) matching
   the canvas mockup, so the compact single-line rows below aren't unlabeled
   at a glance. Widths mirror the row fields' own widths (.set-row-number,
   .set-field-reps/-rpe, .set-row-actions-compact) so the labels roughly line
   up over their column, though pixel-perfect alignment isn't the point --
   only .set-header-weight's text is aria-hidden (plus the other plain
   labels); the nested unit-toggle group stays in the accessibility tree
   since it's interactive. */
.set-header-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px 6px;
}

.set-header-row > span {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  color: var(--text-dim);
  text-transform: uppercase;
}

.set-header-number {
  width: 28px;
  flex-shrink: 0;
}

.set-header-weight {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.set-header-reps {
  width: 44px;
  flex-shrink: 0;
  text-align: center;
}

.set-header-rpe {
  width: 34px;
  flex-shrink: 0;
  text-align: center;
}

.set-header-spacer {
  width: 56px;
  flex-shrink: 0;
}

/* Backlog item 1: shared unit toggle drives every row's weight unit instead
   of repeating a full-width lb/kg <select> on every one -- now embedded
   inline in the header (above) next to the "Weight" label. */
.unit-toggle {
  display: flex;
  gap: 4px;
}

.unit-btn {
  min-height: 22px;
  padding: 0 8px;
  font-size: 0.62rem;
  background: var(--surface-2);
}

.unit-btn.unit-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}

/* Redesign item 67 follow-up: the set-rows panel slides/fades in step with
   the exercise card when swiping between exercises -- without this, only
   the small card animated while this larger area's values just snapped to
   the next exercise's, reading as two disconnected things happening at
   once. A plain keyframe animation (toggled from the script, not a keyed
   <Transition>) rather than remounting: see setRowsPanelEl's watcher for
   why a remount here is a real bug, not just style. overflow-x (not
   overflow, which would also clip vertically) keeps the horizontal slide
   from spilling past the card's edges while still letting the panel size to
   however many rows the new exercise has. */
.set-rows-viewport {
  overflow-x: hidden;
}

@keyframes set-rows-slide-in-next {
  from {
    transform: translateX(20px);
    opacity: 0;
  }
}

@keyframes set-rows-slide-in-prev {
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
}

.set-rows-panel-anim-next {
  animation: set-rows-slide-in-next 0.22s ease;
}

.set-rows-panel-anim-prev {
  animation: set-rows-slide-in-prev 0.22s ease;
}

.set-rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.set-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.set-row-number {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 0.85rem;
  font-weight: 700;
}

.set-row-done {
  flex: 1;
  min-width: 0;
  font-size: 1.05rem;
  font-weight: 600;
}

/* The draft branch's vertical stack: the one-line row, then any error below
   it — kept as its own flex column so it (not `.set-row`) is what fills the
   space next to the fixed-width number circle. */
.set-row-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

/* Redesign item 67 (and its follow-up): a single line matching the canvas
   mockup exactly — number, weight, reps, RPE, then two small circular
   action buttons, all inline, rather than fields stacked above a full-width
   "Add set" button underneath. Tap-to-edit compact fields (an underlined
   value per field, numeric keypad on tap) replace the +/- steppers
   (`1b3f9fe`); native spin-button appearance stays suppressed (below) since
   the compact underlined style reads cleanest without them and mobile entry
   goes through the numeric keypad anyway. RPE rides along as a fourth
   field, same pattern, dashed/dim placeholder since it's optional. */
.set-row-line {
  display: flex;
  align-items: center;
  gap: 10px;
}

.set-field {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
}

.set-field-weight {
  flex: 1;
  min-width: 0;
  flex-direction: row;
  align-items: baseline;
  gap: 4px;
}

.set-field-reps {
  align-items: flex-end;
}

.set-field-rpe {
  align-items: center;
}

.set-field-unit {
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--text-dim);
}

.set-input-compact {
  width: 44px;
  min-height: 28px;
  padding: 0 0 2px;
  background: none;
  border: none;
  border-bottom: 2px solid var(--accent);
  color: var(--accent);
  text-align: center;
  font-size: 1.05rem;
  font-weight: 800;
  -moz-appearance: textfield;
}

.set-input-compact::-webkit-inner-spin-button,
.set-input-compact::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.set-input-rpe-compact {
  width: 34px;
  border-bottom: 1px dashed var(--text-dim);
  color: var(--text-dim);
  text-align: center;
  font-size: 0.9rem;
  font-weight: 700;
}

/* Small circular buttons matching the mockup, replacing the earlier
   full-width "Add set" text button and 46px square remove button — grouped
   together at the end of the line the same way the canvas groups them. */
.set-row-actions-compact {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
}

.log-btn-compact {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--accent);
  border: none;
  color: var(--accent-text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.log-btn-compact:disabled {
  opacity: 0.4;
}

.log-btn-compact-retry {
  background: var(--danger);
  color: white;
}

.remove-row-btn-compact {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  min-height: 0;
  padding: 0;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.add-row-btn {
  width: 100%;
  margin-top: 10px;
  background: transparent;
  border-style: dashed;
  color: var(--text-dim);
}

.row-error {
  color: var(--danger);
  font-size: 0.8rem;
  margin: 0;
}

</style>
