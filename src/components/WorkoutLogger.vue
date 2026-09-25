<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useExercisesStore } from '../stores/exercises'
import { usePushSubscriptionStore } from '../stores/pushSubscription'
import { useTemplatesStore } from '../stores/templates'
import { useWorkoutsStore } from '../stores/workouts'
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
const templateId = ref('')
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
// grouped by exercise in the order they were logged, so the "last time"
// card and the reps/weight pre-fill can both read off it.
const previousSetsByExercise = computed(() => {
  const grouped: Record<string, SetWithExercise[]> = {}
  for (const set of workout.previousWorkout?.sets ?? []) {
    ;(grouped[set.exercise_id] ??= []).push(set)
  }
  return grouped
})

// Once an exercise is picked, narrow the "Last time" card to just that
// exercise instead of the whole previous workout — keeps the screen short
// enough to use mid-set without scrolling past exercises that aren't next.
const visiblePreviousExercises = computed(() => {
  const entries = Object.entries(previousSetsByExercise.value)
  return exerciseId.value ? entries.filter(([exId]) => exId === exerciseId.value) : entries
})

// Backlog item 25: a template can still reference an exercise after it's
// been archived (archiving only flips exercises.is_archived, it doesn't
// touch workout_template_exercises), so this filters archived exercises out
// of the suggested chips and the picker below rather than treating the join
// table as the source of truth for what's loggable. Checks the live
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

// Backlog item 21: logging against a template restricts the exercise picker
// to that template's exercises — the suggested chips below were already
// scoped this way, but the dropdown itself wasn't, so picking from it (not
// a chip) could add an exercise the template doesn't track. Matters beyond
// just the chip/dropdown mismatch: "Last time" and the post-workout volume
// chart both read every set in a templated workout as if it belonged to the
// template, so an ad-hoc addition there leaks into that reporting. A
// workout with no template keeps the full exercise list.
const availableExercises = computed(() => {
  if (!workout.activeTemplateId) return exercises.activeExercises
  return activeTemplateExercises.value.map((te) => ({
    id: te.exercise_id,
    name: te.exercises?.name ?? 'Unknown',
  }))
})

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
  if (recovered.template_id) {
    await workout.fetchPreviousWorkout(recovered.template_id, recovered.id)
    if (!templates.exercisesByTemplate[recovered.template_id]) {
      await templates.fetchTemplateExercises(recovered.template_id)
    }
  }
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
  errorMessage.value = ''
  // A brand-new workout session starts with no drafts of its own — without
  // this, a leftover unsaved row from a just-finished workout (e.g. the
  // auto-replenished blank row after the last set of a no-target exercise)
  // would resurface the moment the same exercise is picked again.
  draftRowsByExercise.value = {}
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
}

function pickSuggested(id: string) {
  exerciseId.value = id
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
  rpeOpen: boolean
  saving: boolean
  error: string
}

function makeDraftRow(): DraftRow {
  return { key: crypto.randomUUID(), reps: null, weight: null, rpe: null, rpeOpen: false, saving: false, error: '' }
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

// Position-indexed, same rule as the old applyPrefill: set N this session
// pre-fills from set N last time (not just "the last set logged"), since a
// superset's interleaved order would otherwise pre-fill from the wrong
// exercise's most recent set.
function applyPrefillToRow(row: DraftRow, id: string, position: number) {
  const matchingSet = previousSetsByExercise.value[id]?.[position]
  if (!matchingSet) {
    row.reps = null
    row.weight = null
    return
  }
  row.reps = matchingSet.reps
  row.weight = matchingSet.weight
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
  const { error } = await workout.addSet(id, row.reps, row.weight, rowWeightUnit.value, normalizeRpe(row.rpe))
  row.saving = false
  if (error) {
    row.error = error.message
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

  startRestIfConfigured(id)
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

function handleFinishClick() {
  if (workout.activeSets.length === 0 && !confirmingEmptyFinish.value) {
    confirmingEmptyFinish.value = true
    return
  }
  handleFinish()
}

async function handleFinish() {
  const finishedTemplateId = workout.activeTemplateId
  const hadSets = workout.activeSets.length > 0

  await workout.finishWorkout()
  confirmingEmptyFinish.value = false
  notes.value = ''
  templateId.value = ''
  exerciseId.value = ''
  draftRowsByExercise.value = {}
  recordCelebration.value = null

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
            <button type="submit">Start workout</button>
          </form>
        </template>
      </template>
    </template>

    <div v-else>
      <p v-if="exercises.activeExercises.length === 0" class="empty">
        No exercises yet. Add one under the Exercises tab first.
      </p>

      <template v-else>
        <div v-if="workout.previousWorkout" class="card last-time">
          <h3>Last time</h3>
          <p v-if="!exerciseId && workout.previousWorkout.notes" class="row-sub">
            {{ workout.previousWorkout.notes }}
          </p>
          <ul class="last-time-list">
            <li v-for="[exId, sets] in visiblePreviousExercises" :key="exId">
              <span class="row-title">{{ sets[0].exercises?.name ?? 'Unknown' }}</span>
              <span class="row-sub">
                {{ sets.map((s) => `${s.reps}×${s.weight}${s.weight_unit}`).join(', ') }}
              </span>
            </li>
          </ul>
        </div>

        <div v-if="workout.activeTemplateId" class="suggested">
          <button
            v-for="te in activeTemplateExercises"
            :key="te.id"
            type="button"
            class="ghost chip"
            :class="{ 'chip-selected': exerciseId === te.exercise_id }"
            :aria-pressed="exerciseId === te.exercise_id"
            @click="pickSuggested(te.exercise_id)"
          >
            {{ te.exercises?.name }}
          </button>
        </div>

        <div class="card">
          <label for="set-exercise">Exercise</label>
          <select id="set-exercise" v-model="exerciseId" required>
            <option value="" disabled>Select an exercise</option>
            <option v-for="exercise in availableExercises" :key="exercise.id" :value="exercise.id">
              {{ exercise.name }}
            </option>
          </select>

          <p v-if="selectedExerciseNotes" class="setup-notes">{{ selectedExerciseNotes }}</p>

          <template v-if="exerciseId">
            <div class="unit-toggle" role="group" aria-label="Units">
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
            </div>

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
                  <div class="set-row-fields">
                    <label class="sr-only" :for="`row-reps-${entry.row.key}`">Reps</label>
                    <input
                      :id="`row-reps-${entry.row.key}`"
                      v-model.number="entry.row.reps"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      placeholder="Reps"
                      class="set-input"
                    />
                    <span class="set-row-x" aria-hidden="true">×</span>
                    <label class="sr-only" :for="`row-weight-${entry.row.key}`">Weight</label>
                    <input
                      :id="`row-weight-${entry.row.key}`"
                      v-model.number="entry.row.weight"
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.5"
                      :placeholder="rowWeightUnit"
                      class="set-input"
                    />
                    <button v-if="!entry.row.rpeOpen" type="button" class="rpe-toggle" @click="entry.row.rpeOpen = true">
                      +RPE
                    </button>
                    <span v-else class="rpe-inline">
                      <label class="sr-only" :for="`row-rpe-${entry.row.key}`">RPE (optional)</label>
                      <input
                        :id="`row-rpe-${entry.row.key}`"
                        v-model.number="entry.row.rpe"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        max="10"
                        step="0.5"
                        placeholder="RPE"
                        class="set-input set-input-rpe"
                      />
                    </span>
                  </div>
                  <div class="set-row-actions">
                    <button
                      type="button"
                      class="log-btn"
                      :disabled="entry.row.reps === null || entry.row.weight === null || entry.row.saving"
                      @click="completeRow(exerciseId, entry.row)"
                    >
                      Add set
                    </button>
                    <button
                      type="button"
                      class="remove-row-btn"
                      :aria-label="`Remove row ${entry.number}`"
                      @click="removeDraftRow(exerciseId, entry.row)"
                    >
                      ✕
                    </button>
                  </div>
                  <p v-if="entry.row.error" class="row-error">{{ entry.row.error }}</p>
                </template>
              </li>
            </ul>

            <button type="button" class="add-row-btn" @click="addDraftRow(exerciseId)">+ Add row</button>
          </template>
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
      <button v-else type="button" class="btn-accent finish" @click="handleFinishClick">Finish workout</button>
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

.last-time-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}

.last-time-list li {
  display: flex;
  flex-direction: column;
}

.suggested {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}

.chip {
  min-height: 36px;
  padding: 0 14px;
  font-size: 0.85rem;
  font-weight: 500;
}

/* Backlog item 50: the suggested chips and the exercise <select> below set
   the same exerciseId, so a chip highlights the same way the template picker
   does once its exercise is selected -- via either the chip or the dropdown -
   making the relationship visible instead of leaving them looking unrelated. */
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

/* Backlog item 1: compact numbered rows replacing the old one-set-at-a-time
   form. Shared unit toggle sits once above the rows instead of repeating a
   full-width lb/kg <select> on every one. */
.unit-toggle {
  display: flex;
  gap: 6px;
  margin: 12px 0;
}

.unit-btn {
  min-height: 36px;
  padding: 0 16px;
  font-size: 0.85rem;
  background: var(--surface-2);
}

.unit-btn.unit-selected {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}

.set-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.set-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.set-row-number {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 0.7rem;
}

.set-row-done {
  flex: 1;
  min-width: 0;
  font-size: 0.9rem;
  font-weight: 600;
}

.set-row-fields {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

.set-input {
  width: 60px;
  min-height: 40px;
  padding: 0 8px;
  text-align: center;
  flex-shrink: 0;
}

.set-input-rpe {
  width: 52px;
}

.set-row-x {
  color: var(--text-dim);
  flex-shrink: 0;
}

.rpe-toggle {
  flex-shrink: 0;
  min-height: 32px;
  padding: 0 10px;
  font-size: 0.72rem;
  background: transparent;
  border-style: dashed;
  color: var(--text-dim);
}

.rpe-inline {
  flex-shrink: 0;
}

.set-row-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.log-btn {
  min-height: 36px;
  padding: 0 14px;
  font-size: 0.85rem;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
  font-weight: 700;
}

.remove-row-btn {
  min-height: 36px;
  min-width: 36px;
  padding: 0;
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
}

.add-row-btn {
  width: 100%;
  margin-top: 10px;
  background: transparent;
  border-style: dashed;
  color: var(--text-dim);
}

.row-error {
  flex-basis: 100%;
  color: var(--danger);
  font-size: 0.78rem;
  margin: 0;
}

</style>
