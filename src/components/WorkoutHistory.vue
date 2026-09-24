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
      <button
        type="button"
        class="icon-button delete-trigger"
        aria-label="Delete workout"
        @click="confirmingDeleteId = entry.id"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      </button>

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
    </div>
  </div>
</template>

<style scoped>
.card {
  position: relative;
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
  padding-right: 32px;
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

.icon-button {
  width: 36px;
  height: 36px;
  min-height: auto;
  padding: 0;
  border-radius: var(--radius);
  background: transparent;
  border: none;
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-button:hover,
.icon-button:focus-visible {
  color: var(--danger);
}

.delete-trigger {
  position: absolute;
  top: 8px;
  right: 8px;
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
