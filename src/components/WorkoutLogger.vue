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

const notes = ref('')
const templateId = ref('')
const exerciseId = ref('')
const reps = ref<number | null>(null)
const weight = ref<number | null>(null)
const weightUnit = ref<WeightUnit>('lb')
const rpe = ref<number | null>(null)
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
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleRestVisibilityChange)
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

async function handleStart() {
  errorMessage.value = ''
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

// Pre-fill reps/weight from the previous workout's set at the same
// position (set N this session <- set N last time), not just the last set
// logged, since fatigue means later sets aren't representative of earlier
// ones. Re-runs on every addSet too, not just on exercise selection, so
// picking the same exercise again for set 2 refreshes the pre-fill.
//
// Backlog item 11: tracks the loggedCount it last filled for, so the
// activeSets watcher below (which fires on ANY exercise's add, not just the
// selected one) can tell "this exercise's count changed" from "some other
// exercise's addSet response landed in the background." Without that check,
// a superset partner's slow-arriving response can re-run this mid-keystroke
// and silently wipe reps/weight back to null/prefill under the user's
// fingers, turning their next "Add set" tap into a no-op (see the guard in
// handleAddSet).
let lastFilledCount: number | null = null

function applyPrefill(id: string) {
  const previousSets = previousSetsByExercise.value[id]
  const loggedCount = workout.activeSets.filter((s) => s.exercise_id === id).length
  lastFilledCount = loggedCount
  const matchingSet = previousSets?.[loggedCount]
  if (!matchingSet) {
    reps.value = null
    weight.value = null
    return
  }
  reps.value = matchingSet.reps
  weight.value = matchingSet.weight
  weightUnit.value = matchingSet.weight_unit
}

watch(exerciseId, (id) => {
  if (!id) return
  applyPrefill(id)
})

watch(
  () => workout.activeSets.length,
  () => {
    if (!exerciseId.value) return
    const loggedCount = workout.activeSets.filter((s) => s.exercise_id === exerciseId.value).length
    if (loggedCount === lastFilledCount) return
    applyPrefill(exerciseId.value)
  },
)

// Backlog item 11: without this, nothing stops a second "Add set" tap from
// firing while the first is still in flight, so two inserts can race over
// the network and commit in the opposite order from how they were tapped —
// set_index (assigned by DB commit order, supabase/schema.sql) then
// disagrees with what the user actually logged first. Disabling the button
// for the duration of the request makes overlapping submissions impossible
// rather than just unlikely.
const addingSet = ref(false)

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

// RPE is optional, so its input has no `required` guard forcing reps/weight
// to a real value before submit — v-model.number leaves an emptied field as
// '' rather than coercing it to null, and that '' sent straight through to
// Postgres's numeric rpe column is what throws "invalid input syntax for
// type numeric".
function normalizeRpe(value: number | null): number | null {
  return (value as unknown) === '' ? null : value
}

async function handleAddSet() {
  errorMessage.value = ''
  if (!exerciseId.value || reps.value === null || weight.value === null) return

  addingSet.value = true
  const { error } = await workout.addSet(
    exerciseId.value,
    reps.value,
    weight.value,
    weightUnit.value,
    normalizeRpe(rpe.value),
  )
  addingSet.value = false
  if (error) {
    errorMessage.value = error.message
  } else {
    rpe.value = null
    const restSeconds = exercises.exercises.find((e) => e.id === exerciseId.value)?.rest_seconds
    if (restSeconds) {
      restPushSent = false
      activeRest.value = {
        exerciseName: exerciseName(exerciseId.value),
        endsAt: Date.now() + restSeconds * 1000,
        totalSeconds: restSeconds,
      }
      // Covers the rare case where the set is logged while already
      // backgrounded (e.g. a delayed background response) — nothing will
      // ever see the in-app screen, so send the fallback immediately
      // instead of waiting on a visibilitychange that already happened.
      handleRestVisibilityChange()
    }
  }
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

async function handleDeleteSet(id: string) {
  errorMessage.value = ''
  if (editingSetId.value === id) editingSetId.value = null
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

async function handleFinish() {
  const finishedTemplateId = workout.activeTemplateId
  const hadSets = workout.activeSets.length > 0

  await workout.finishWorkout()
  notes.value = ''
  templateId.value = ''
  exerciseId.value = ''
  reps.value = null
  weight.value = null
  rpe.value = null
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
    <h2>Log a workout</h2>

    <div v-if="showingVolumeChart" class="card">
      <h3>Volume over time</h3>
      <VolumeChart :points="workout.volumeHistory" />
      <button type="button" class="ghost finish chart-dismiss" @click="dismissVolumeChart">Log another workout</button>
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
            @click="pickSuggested(te.exercise_id)"
          >
            {{ te.exercises?.name }}
          </button>
        </div>

        <form class="card" @submit.prevent="handleAddSet">
          <label for="set-exercise">Exercise</label>
          <select id="set-exercise" v-model="exerciseId" required>
            <option value="" disabled>Select an exercise</option>
            <option v-for="exercise in availableExercises" :key="exercise.id" :value="exercise.id">
              {{ exercise.name }}
            </option>
          </select>

          <p v-if="selectedExerciseNotes" class="setup-notes">{{ selectedExerciseNotes }}</p>

          <template v-if="exerciseId">
            <div class="grid-2">
              <div>
                <label for="set-reps">Reps</label>
                <input id="set-reps" v-model.number="reps" type="number" inputmode="numeric" min="1" required />
              </div>
              <div>
                <label for="set-weight">Weight</label>
                <input
                  id="set-weight"
                  v-model.number="weight"
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
                <label for="set-unit">Unit</label>
                <select id="set-unit" v-model="weightUnit">
                  <option value="lb">lb</option>
                  <option value="kg">kg</option>
                </select>
              </div>
              <div>
                <label for="set-rpe">RPE (optional)</label>
                <input
                  id="set-rpe"
                  v-model.number="rpe"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  max="10"
                  step="0.5"
                />
              </div>
            </div>

            <button type="submit" :disabled="addingSet">Add set</button>
          </template>
        </form>
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
              <button type="button" class="ghost small" @click="handleDeleteSet(set.id)">Delete</button>
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

      <button type="button" class="ghost finish" @click="handleFinish">Finish workout</button>
    </div>

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
      v-if="activeRest"
      :exercise-name="activeRest.exerciseName"
      :ends-at="activeRest.endsAt"
      :total-seconds="activeRest.totalSeconds"
      @dismiss="activeRest = null"
    />
  </div>
</template>

<style scoped>
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

.ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
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

</style>
