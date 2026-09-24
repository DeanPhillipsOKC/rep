<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { usePushSubscriptionStore } from '../stores/pushSubscription'
import { useTemplatesStore } from '../stores/templates'
import { useWorkoutsStore } from '../stores/workouts'
import VolumeChart from './VolumeChart.vue'
import type { SetEntry, SetWithExercise, WeightUnit } from '../lib/types'

const exercises = useExercisesStore()
const push = usePushSubscriptionStore()
const templates = useTemplatesStore()
const workout = useWorkoutsStore()

// Backlog item 26: pre-start guidance points a brand-new account at the
// Exercises/Templates tabs instead of App.vue owning that navigation —
// same emit-and-let-the-parent-switch-`view` pattern AppMenu.vue uses.
const emit = defineEmits<{
  (e: 'navigate', view: 'exercises' | 'templates'): void
}>()

const notes = ref('')
const templateId = ref('')
const exerciseId = ref('')
const reps = ref<number | null>(null)
const weight = ref<number | null>(null)
const weightUnit = ref<WeightUnit>('lb')
const rpe = ref<number | null>(null)
const errorMessage = ref('')

// Backlog item 4: congratulatory toast when a set beats the all-time best
// for that exercise. Auto-dismisses so it doesn't block the next set.
const recordToast = ref('')
let recordToastTimeout: ReturnType<typeof setTimeout> | undefined

function showRecordToast(name: string) {
  recordToast.value = `New record: ${name}`
  clearTimeout(recordToastTimeout)
  recordToastTimeout = setTimeout(() => {
    recordToast.value = ''
  }, 4000)
}

// addSet's record check runs in the background (see workouts.ts) so it
// never delays the add; react to it landing whenever it does.
watch(
  () => workout.newRecord,
  (record) => {
    if (record) showRecordToast(exerciseName(record.exerciseId))
  },
)

onMounted(() => {
  if (exercises.exercises.length === 0) exercises.fetchExercises()
  if (templates.templates.length === 0) templates.fetchTemplates()
  workout.fetchProgressStats()
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
  return (templates.exercisesByTemplate[workout.activeTemplateId] ?? []).map((te) => ({
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

async function handleAddSet() {
  errorMessage.value = ''
  if (!exerciseId.value || reps.value === null || weight.value === null) return

  addingSet.value = true
  const { error } = await workout.addSet(exerciseId.value, reps.value, weight.value, weightUnit.value, rpe.value)
  addingSet.value = false
  if (error) {
    errorMessage.value = error.message
  } else {
    rpe.value = null
    // Backlog item 15: kicked off in the background so it never delays the
    // next set — the Edge Function holds the actual rest delay server-side.
    const restSeconds = exercises.exercises.find((e) => e.id === exerciseId.value)?.rest_seconds
    if (restSeconds) push.sendRestReminder(exerciseName(exerciseId.value), restSeconds)
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
  const { error } = await workout.updateSet(id, editReps.value, editWeight.value, editWeightUnit.value, editRpe.value)
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
  recordToast.value = ''
  clearTimeout(recordToastTimeout)

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
      <div class="progress-strip">
        <div class="stat-tile">
          <span class="stat-value">{{ workout.workoutsThisWeek }}</span>
          <span class="stat-label">{{ workout.workoutsThisWeek === 1 ? 'workout' : 'workouts' }} this week</span>
        </div>
        <div v-if="workout.recentPrExerciseName" class="stat-tile stat-tile-pr">
          <span class="stat-value">PR</span>
          <span class="stat-label">{{ workout.recentPrExerciseName }}</span>
        </div>
      </div>

      <div v-if="exercises.activeExercises.length === 0" class="card notice">
        <p>Add an exercise before logging a workout — there's nothing to pick from yet.</p>
        <button type="button" class="ghost" @click="emit('navigate', 'exercises')">Go to Exercises</button>
      </div>

      <template v-else>
        <p v-if="templates.activeTemplates.length === 0" class="row-sub hint">
          Templates are optional — they track progress on a recurring workout. Freeform logging works fine without
          one, or <button type="button" class="link-button" @click="emit('navigate', 'templates')">create one</button>
          under Templates.
        </p>

        <form class="card" @submit.prevent="handleStart">
          <label for="workout-template">Template (optional)</label>
          <select id="workout-template" v-model="templateId">
            <option value="">No template — freeform</option>
            <option v-for="template in templates.activeTemplates" :key="template.id" :value="template.id">
              {{ template.name }}
            </option>
          </select>

          <label for="workout-notes">Notes (optional)</label>
          <input id="workout-notes" v-model="notes" type="text" />
          <button type="submit">Start workout</button>
        </form>
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
            v-for="te in templates.exercisesByTemplate[workout.activeTemplateId]"
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

    <div v-if="recordToast" class="record-toast">{{ recordToast }}</div>
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

.stat-tile-pr {
  background: var(--success);
  border-color: var(--success);
}

.stat-tile-pr .stat-value,
.stat-tile-pr .stat-label {
  color: var(--accent-text);
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

.notice {
  text-align: center;
}

.notice p {
  margin: 0 0 12px;
  color: var(--text-dim);
}

.hint {
  margin: 0 0 16px;
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
  font-size: 0.8rem;
  color: var(--text-dim);
  background: var(--surface-2);
  border-radius: var(--radius);
  padding: 8px 10px;
  margin: -4px 0 4px;
  white-space: pre-wrap;
}

.record-toast {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  background: var(--accent);
  color: var(--accent-text);
  padding: 12px 20px;
  border-radius: var(--radius);
  font-weight: 600;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  z-index: 10;
}
</style>
