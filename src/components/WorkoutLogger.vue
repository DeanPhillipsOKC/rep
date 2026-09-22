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

    <div v-if="!workout.activeWorkoutId">
      <form @submit.prevent="handleStart">
        <label for="workout-notes">Notes (optional)</label>
        <input id="workout-notes" v-model="notes" type="text" />
        <button type="submit">Start workout</button>
      </form>
    </div>

    <div v-else>
      <p v-if="exercises.activeExercises.length === 0">
        No exercises yet. Add one under the Exercises tab first.
      </p>

      <form v-else @submit.prevent="handleAddSet">
        <label for="set-exercise">Exercise</label>
        <select id="set-exercise" v-model="exerciseId" required>
          <option value="" disabled>Select an exercise</option>
          <option v-for="exercise in exercises.activeExercises" :key="exercise.id" :value="exercise.id">
            {{ exercise.name }}
          </option>
        </select>

        <label for="set-reps">Reps</label>
        <input id="set-reps" v-model.number="reps" type="number" min="1" required />

        <label for="set-weight">Weight</label>
        <input id="set-weight" v-model.number="weight" type="number" min="0" step="0.5" required />

        <label for="set-unit">Unit</label>
        <select id="set-unit" v-model="weightUnit">
          <option value="lb">lb</option>
          <option value="kg">kg</option>
        </select>

        <label for="set-rpe">RPE (optional)</label>
        <input id="set-rpe" v-model.number="rpe" type="number" min="0" max="10" step="0.5" />

        <button type="submit">Add set</button>
      </form>

      <ol>
        <li v-for="set in workout.activeSets" :key="set.id">
          {{ exerciseName(set.exercise_id) }} — {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
          <span v-if="set.rpe !== null"> @ RPE {{ set.rpe }}</span>
        </li>
      </ol>

      <button type="button" @click="handleFinish">Finish workout</button>
    </div>

    <p v-if="errorMessage">{{ errorMessage }}</p>
  </div>
</template>
