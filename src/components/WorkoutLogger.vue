<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { useWorkoutsStore } from '../stores/workouts'
import type { WeightUnit } from '../lib/types'

const exercises = useExercisesStore()
const workout = useWorkoutsStore()

const notes = ref('')
const exerciseId = ref('')
const reps = ref<number | null>(null)
const weight = ref<number | null>(null)
const weightUnit = ref<WeightUnit>('lb')
const rpe = ref<number | null>(null)
const errorMessage = ref('')

onMounted(() => {
  if (exercises.exercises.length === 0) exercises.fetchExercises()
})

async function handleStart() {
  errorMessage.value = ''
  const { error } = await workout.startWorkout(notes.value || null)
  if (error) errorMessage.value = error.message
}

async function handleAddSet() {
  errorMessage.value = ''
  if (!exerciseId.value || reps.value === null || weight.value === null) return

  const { error } = await workout.addSet(exerciseId.value, reps.value, weight.value, weightUnit.value, rpe.value)
  if (error) {
    errorMessage.value = error.message
  } else {
    reps.value = null
    weight.value = null
    rpe.value = null
  }
}

function exerciseName(id: string): string {
  return exercises.exercises.find((e) => e.id === id)?.name ?? 'Unknown'
}

function handleFinish() {
  workout.finishWorkout()
  notes.value = ''
}
</script>

<template>
  <div>
    <h2>Log a workout</h2>

    <form v-if="!workout.activeWorkoutId" class="card" @submit.prevent="handleStart">
      <label for="workout-notes">Notes (optional)</label>
      <input id="workout-notes" v-model="notes" type="text" />
      <button type="submit">Start workout</button>
    </form>

    <div v-else>
      <p v-if="exercises.activeExercises.length === 0" class="empty">
        No exercises yet. Add one under the Exercises tab first.
      </p>

      <form v-else class="card" @submit.prevent="handleAddSet">
        <label for="set-exercise">Exercise</label>
        <select id="set-exercise" v-model="exerciseId" required>
          <option value="" disabled>Select an exercise</option>
          <option v-for="exercise in exercises.activeExercises" :key="exercise.id" :value="exercise.id">
            {{ exercise.name }}
          </option>
        </select>

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
            <input id="set-rpe" v-model.number="rpe" type="number" inputmode="decimal" min="0" max="10" step="0.5" />
          </div>
        </div>

        <button type="submit">Add set</button>
      </form>

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

.finish {
  width: 100%;
}

.error {
  color: var(--danger);
}
</style>
