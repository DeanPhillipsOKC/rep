<script setup lang="ts">
import { ref } from 'vue'
import AuthGate from './components/AuthGate.vue'
import ExerciseList from './components/ExerciseList.vue'
import WorkoutHistory from './components/WorkoutHistory.vue'
import WorkoutLogger from './components/WorkoutLogger.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const view = ref<'log' | 'exercises' | 'history'>('log')
</script>

<template>
  <main>
    <AuthGate>
      <h1>Workout Tracker</h1>

      <nav>
        <button type="button" :disabled="view === 'log'" @click="view = 'log'">Log</button>
        <button type="button" :disabled="view === 'exercises'" @click="view = 'exercises'">Exercises</button>
        <button type="button" :disabled="view === 'history'" @click="view = 'history'">History</button>
        <button type="button" @click="auth.signOut()">Sign out</button>
      </nav>

      <WorkoutLogger v-if="view === 'log'" />
      <ExerciseList v-else-if="view === 'exercises'" />
      <WorkoutHistory v-else-if="view === 'history'" />
    </AuthGate>
  </main>
</template>
