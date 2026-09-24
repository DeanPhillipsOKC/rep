<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWorkoutsStore } from '../stores/workouts'

const workout = useWorkoutsStore()
const errorMessage = ref('')

// Backlog item 31: id of the card showing its "are you sure" delete confirm
// — null means none. Same inline-toggle pattern as ExerciseList.vue's
// editing state, since this action is destructive with no undo.
const confirmingDeleteId = ref<string | null>(null)

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

async function confirmDelete(id: string) {
  errorMessage.value = ''
  const { error } = await workout.deleteWorkout(id)
  if (error) {
    errorMessage.value = error.message
  }
  confirmingDeleteId.value = null
}
</script>

<template>
  <div>
    <h2>History</h2>

    <p v-if="workout.loading">Loading…</p>
    <p v-if="workout.errorMessage" class="error">{{ workout.errorMessage }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
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

      <div v-if="confirmingDeleteId === entry.id" class="confirm-delete">
        <span class="row-sub">Delete this workout? This can't be undone.</span>
        <div class="confirm-actions">
          <button type="button" class="danger small" @click="confirmDelete(entry.id)">Confirm delete</button>
          <button type="button" class="ghost small" @click="confirmingDeleteId = null">Cancel</button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="ghost small delete-trigger"
        @click="confirmingDeleteId = entry.id"
      >
        Delete
      </button>
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

.delete-trigger {
  margin-top: 12px;
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

.ghost.small {
  min-height: 36px;
  padding: 0 12px;
  font-size: 0.85rem;
  flex-shrink: 0;
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
</style>
