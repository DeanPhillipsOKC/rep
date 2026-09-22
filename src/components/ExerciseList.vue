<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'

const exercises = useExercisesStore()
const name = ref('')
const category = ref('')
const errorMessage = ref('')

onMounted(() => {
  exercises.fetchExercises()
})

async function handleCreate() {
  errorMessage.value = ''
  const { error } = await exercises.createExercise(name.value, category.value || null)
  if (error) {
    errorMessage.value = error.message
  } else {
    name.value = ''
    category.value = ''
  }
}
</script>

<template>
  <div>
    <h2>Exercises</h2>

    <form @submit.prevent="handleCreate">
      <label for="exercise-name">Name</label>
      <input id="exercise-name" v-model="name" type="text" required />

      <label for="exercise-category">Category</label>
      <input id="exercise-category" v-model="category" type="text" list="categories" />
      <datalist id="categories">
        <option value="push" />
        <option value="pull" />
        <option value="legs" />
        <option value="cardio" />
      </datalist>

      <button type="submit">Add exercise</button>
    </form>

    <p v-if="errorMessage">{{ errorMessage }}</p>
    <p v-if="exercises.loading">Loading…</p>

    <ul>
      <li v-for="exercise in exercises.activeExercises" :key="exercise.id">
        {{ exercise.name }}
        <span v-if="exercise.category">({{ exercise.category }})</span>
        <button type="button" @click="exercises.archiveExercise(exercise.id)">Archive</button>
      </li>
    </ul>
    <p v-if="!exercises.loading && exercises.activeExercises.length === 0">
      No exercises yet. Add one above before logging a workout.
    </p>
  </div>
</template>
