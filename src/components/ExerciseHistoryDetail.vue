<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { useWorkoutsStore } from '../stores/workouts'
import { heaviestSetByUnit } from '../lib/exerciseHistory'

// Backlog item 1: focused per-exercise history, opened from the Exercises
// tab (ExerciseList.vue) and the active logger (WorkoutLogger.vue) so the
// prior session for one exercise is findable without scanning the whole
// History timeline. A full-screen overlay rather than a route -- same
// pattern as RestTimer.vue/RecordCelebration.vue -- so opening it mid-workout
// doesn't unmount WorkoutLogger.vue and lose whatever's still unsaved in its
// local draft-row state.
const props = defineProps<{ exerciseId: string }>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const exercises = useExercisesStore()
const workout = useWorkoutsStore()

// `exercises.exercises` (not `activeExercises`) so an archived exercise
// still resolves to its name/notes here -- its past sets don't stop existing
// just because logging new ones against it is no longer offered.
const exercise = computed(() => exercises.exercises.find((e) => e.id === props.exerciseId) ?? null)

const heaviestSummary = computed(() => {
  const heaviest = heaviestSetByUnit(workout.exerciseHistory)
  return (Object.entries(heaviest) as [string, number][]).sort(([a], [b]) => a.localeCompare(b))
})

onMounted(() => {
  if (exercises.exercises.length === 0) exercises.fetchExercises()
  workout.fetchExerciseHistory(props.exerciseId)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  workout.clearExerciseHistory()
})

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('dismiss')
}

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
  <div
    class="history-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="`${exercise?.name ?? 'Exercise'} history`"
    @click.self="emit('dismiss')"
  >
    <div class="history-panel">
      <div class="history-header">
        <div class="history-heading">
          <h2>{{ exercise?.name ?? 'Exercise' }}</h2>
          <span v-if="exercise?.is_archived" class="tag-pill">Archived</span>
        </div>
        <button type="button" class="icon-button" aria-label="Close history" @click="emit('dismiss')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div v-if="heaviestSummary.length > 0" class="card summary-card">
        <span class="summary-label">Heaviest completed set</span>
        <div class="summary-values">
          <span v-for="[unit, weight] in heaviestSummary" :key="unit" class="summary-value">
            {{ weight }}{{ unit }}
          </span>
        </div>
      </div>

      <p v-if="workout.exerciseHistoryLoading">Loading…</p>
      <p v-if="workout.exerciseHistoryError" class="error">{{ workout.exerciseHistoryError }}</p>
      <p v-if="!workout.exerciseHistoryLoading && workout.exerciseHistory.length === 0" class="empty">
        No sets logged for this exercise yet.
      </p>

      <ul class="history-list">
        <li v-for="entry in workout.exerciseHistory" :key="entry.workoutId" class="history-entry">
          <h3>{{ formatDate(entry.performedAt) }}</h3>
          <ol class="set-list">
            <li v-for="(set, index) in entry.sets" :key="set.id" class="set-row">
              <span class="set-number">{{ index + 1 }}</span>
              <span class="set-detail">
                {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
                <template v-if="set.rpe !== null"> · RPE {{ set.rpe }}</template>
              </span>
            </li>
          </ol>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.history-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: color-mix(in srgb, var(--bg) 70%, transparent);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.history-panel {
  width: 100%;
  max-width: 480px;
  max-height: 88vh;
  overflow-y: auto;
  background: var(--bg);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 20px 16px calc(24px + env(safe-area-inset-bottom, 0px));
}

.history-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.history-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.history-heading h2 {
  margin: 0;
}

.tag-pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 0.7rem;
  font-weight: 700;
}

.icon-button {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  min-height: auto;
  padding: 0;
  border-radius: var(--radius);
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin-bottom: 20px;
}

.summary-label {
  display: block;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.3px;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 6px;
}

.summary-values {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.summary-value {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--accent);
}

.error {
  color: var(--danger);
}

.empty {
  text-align: center;
  padding: 24px 0;
  color: var(--text-dim);
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.history-entry h3 {
  margin: 0 0 6px;
  font-size: 0.95rem;
}

.set-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.set-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.set-number {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 0.7rem;
  font-weight: 700;
}

.set-detail {
  font-size: 0.9rem;
  color: var(--text);
}
</style>
