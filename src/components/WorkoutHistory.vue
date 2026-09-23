<script setup lang="ts">
import { onMounted } from 'vue'
import { useWorkoutsStore } from '../stores/workouts'

const workout = useWorkoutsStore()

onMounted(() => {
  workout.fetchHistory()
})

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
</script>

<template>
  <div>
    <h2>History</h2>

    <p v-if="workout.loading">Loading…</p>
    <p v-if="workout.errorMessage" class="error">{{ workout.errorMessage }}</p>
    <p v-if="!workout.loading && workout.history.length === 0" class="empty">No workouts logged yet.</p>

    <div v-for="entry in workout.history" :key="entry.id" class="card">
      <div class="entry-header">
        <h3>{{ formatDate(entry.performed_at) }}</h3>
        <span v-if="entry.workout_templates" class="template-tag">{{ entry.workout_templates.name }}</span>
      </div>
      <p v-if="entry.notes" class="notes">{{ entry.notes }}</p>
      <ul class="list">
        <li v-for="set in entry.sets" :key="set.id" class="row">
          <span class="row-title">{{ set.exercises?.name ?? 'Unknown' }}</span>
          <span class="row-sub">
            {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
            <template v-if="set.rpe !== null"> · RPE {{ set.rpe }}</template>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.entry-header h3 {
  margin: 0;
  color: var(--text);
}

.template-tag {
  font-size: 0.75rem;
  color: var(--accent);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 2px 8px;
  flex-shrink: 0;
}

.notes {
  margin-bottom: 12px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.row:first-child {
  border-top: none;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.85rem;
  color: var(--text-dim);
  text-align: right;
}

.error {
  color: var(--danger);
}

.empty {
  text-align: center;
  padding: 32px 0;
}
</style>
