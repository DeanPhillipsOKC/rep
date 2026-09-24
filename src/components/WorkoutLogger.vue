<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { useTemplatesStore } from '../stores/templates'
import { useWorkoutsStore } from '../stores/workouts'
import type { SetWithExercise, WeightUnit } from '../lib/types'

const exercises = useExercisesStore()
const templates = useTemplatesStore()
const workout = useWorkoutsStore()

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
function applyPrefill(id: string) {
  const previousSets = previousSetsByExercise.value[id]
  const loggedCount = workout.activeSets.filter((s) => s.exercise_id === id).length
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
    if (exerciseId.value) applyPrefill(exerciseId.value)
  },
)

async function handleAddSet() {
  errorMessage.value = ''
  if (!exerciseId.value || reps.value === null || weight.value === null) return

  const { error } = await workout.addSet(exerciseId.value, reps.value, weight.value, weightUnit.value, rpe.value)
  if (error) {
    errorMessage.value = error.message
  } else {
    rpe.value = null
  }
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

async function handleFinish() {
  await workout.finishWorkout()
  notes.value = ''
  templateId.value = ''
  exerciseId.value = ''
  reps.value = null
  weight.value = null
  rpe.value = null
  recordToast.value = ''
  clearTimeout(recordToastTimeout)
}
</script>

<template>
  <div>
    <h2>Log a workout</h2>

    <form v-if="!workout.activeWorkoutId" class="card" @submit.prevent="handleStart">
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
            <option v-for="exercise in exercises.activeExercises" :key="exercise.id" :value="exercise.id">
              {{ exercise.name }}
            </option>
          </select>

          <p v-if="selectedExerciseNotes" class="setup-notes">{{ selectedExerciseNotes }}</p>

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

          <button type="submit">Add set</button>
        </form>
      </template>

      <ol class="list">
        <li v-for="(set, index) in workout.activeSets" :key="set.id" class="row">
          <span class="row-index">{{ index + 1 }}</span>
          <span class="row-body">
            <span class="row-title">{{ exerciseName(set.exercise_id) }}</span>
            <span class="row-sub">
              {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
              <template v-if="set.rpe !== null"> · RPE {{ set.rpe }}</template>
            </span>
          </span>
        </li>
      </ol>

      <button type="button" class="ghost finish" @click="handleFinish">Finish workout</button>
    </div>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>

    <div v-if="recordToast" class="record-toast">{{ recordToast }}</div>
  </div>
</template>

<style scoped>
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

.row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 14px;
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
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.ghost {
  background: transparent;
  border-color: var(--border);
  color: var(--text-dim);
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
