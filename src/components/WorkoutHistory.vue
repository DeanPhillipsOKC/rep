<script setup lang="ts">
import { onMounted } from 'vue'
import { useWorkoutsStore } from '../stores/workouts'

const workout = useWorkoutsStore()

onMounted(() => {
  workout.fetchHistory()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString()
}
</script>

<template>
  <div>
    <h2>History</h2>

    <p v-if="workout.loading">Loading…</p>
    <p v-if="workout.errorMessage">{{ workout.errorMessage }}</p>
    <p v-if="!workout.loading && workout.history.length === 0">No workouts logged yet.</p>

    <div v-for="entry in workout.history" :key="entry.id">
      <h3>{{ formatDate(entry.performed_at) }}</h3>
      <p v-if="entry.notes">{{ entry.notes }}</p>
      <ul>
        <li v-for="set in entry.sets" :key="set.id">
          {{ set.exercises?.name ?? 'Unknown' }} — {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
          <span v-if="set.rpe !== null"> @ RPE {{ set.rpe }}</span>
        </li>
      </ul>
    </div>
  </div>
</template>
