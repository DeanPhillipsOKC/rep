<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useWorkoutsStore } from '../stores/workouts'
import { findPrWorkoutIds } from '../lib/progress'
import type { SetWithExercise, WeightUnit, WorkoutWithSets } from '../lib/types'

const workout = useWorkoutsStore()
const errorMessage = ref('')

// Backlog item 31: id of the card showing its "are you sure" delete confirm
// — null means none. Same inline-toggle pattern as ExerciseList.vue's
// editing state, since this action is destructive with no undo.
const confirmingDeleteId = ref<string | null>(null)

// Backlog item 32: fix a wrong rep/weight/RPE entry, remove a set, or edit
// the notes on an already-finished workout — same inline-toggle pattern as
// WorkoutLogger.vue's active-workout set editor (item 13), pointed at
// history's DB writes instead. Scoped to sets that already exist; adding a
// brand-new set to a past workout is out of scope (see docs/backlog.md item 32).
const editingSetId = ref<string | null>(null)
const editReps = ref<number | null>(null)
const editWeight = ref<number | null>(null)
const editWeightUnit = ref<WeightUnit>('lb')
const editRpe = ref<number | null>(null)

const editingNotesId = ref<string | null>(null)
const notesDraft = ref('')

// Backlog item 45: only the most recent workout starts expanded to full
// detail (see the "History" artboard) — everything else renders as a
// condensed summary until tapped open. Re-seeded whenever the newest
// workout's id changes (initial load, or the current newest gets deleted
// and an older one takes its place) so "most recent" always starts open.
const expandedIds = ref<Set<string>>(new Set())
watch(
  () => workout.history[0]?.id,
  (id) => {
    if (id) expandedIds.value.add(id)
  },
  { immediate: true },
)

function toggleExpanded(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

// Backlog item 45: distinct timeline marker for a workout that contained a
// record at the time it was logged — replayed across the full history
// rather than just "was this the most recent workout" (see lib/progress.ts).
const prWorkoutIds = computed(() => findPrWorkoutIds(workout.history))

// One-line stand-in for a condensed card's full set list — unique exercise
// names in the order they were logged, e.g. "Chest Press, Chest Fly + 3 more".
function exerciseSummary(entry: WorkoutWithSets): string {
  const names: string[] = []
  for (const set of entry.sets) {
    const name = set.exercises?.name ?? 'Unknown'
    if (!names.includes(name)) names.push(name)
  }
  if (names.length === 0) return 'No sets logged'
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} + ${names.length - 2} more`
}

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

function startEditingSet(set: SetWithExercise) {
  editingSetId.value = set.id
  editReps.value = set.reps
  editWeight.value = set.weight
  editWeightUnit.value = set.weight_unit
  editRpe.value = set.rpe
}

// RPE is optional — v-model.number leaves an emptied field as '' rather
// than null, and that goes straight through to Postgres's numeric column.
function normalizeRpe(value: number | null): number | null {
  return (value as unknown) === '' ? null : value
}

async function saveSetEdit(id: string) {
  errorMessage.value = ''
  if (editReps.value === null || editWeight.value === null) return
  const { error } = await workout.updateHistorySet(
    id,
    editReps.value,
    editWeight.value,
    editWeightUnit.value,
    normalizeRpe(editRpe.value),
  )
  if (error) {
    errorMessage.value = error.message
  } else {
    editingSetId.value = null
  }
}

async function handleDeleteSet(id: string) {
  errorMessage.value = ''
  if (editingSetId.value === id) editingSetId.value = null
  const { error } = await workout.deleteHistorySet(id)
  if (error) errorMessage.value = error.message
}

function startEditingNotes(entry: WorkoutWithSets) {
  editingNotesId.value = entry.id
  notesDraft.value = entry.notes ?? ''
}

async function saveNotes(id: string) {
  errorMessage.value = ''
  const { error } = await workout.updateWorkoutNotes(id, notesDraft.value.trim() || null)
  if (error) {
    errorMessage.value = error.message
  } else {
    editingNotesId.value = null
  }
}
</script>

<template>
  <div>
    <h2>History</h2>

    <p v-if="workout.loading">Loading…</p>
    <p v-if="workout.errorMessage" class="error">{{ workout.errorMessage }}</p>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="!workout.loading && workout.history.length === 0" class="empty">No workouts logged yet.</p>

    <div class="timeline">
      <div v-for="(entry, index) in workout.history" :key="entry.id" class="timeline-row">
        <div class="rail">
          <span class="dot" :class="{ 'dot-pr': prWorkoutIds.has(entry.id) }"></span>
          <span v-if="index < workout.history.length - 1" class="rail-line"></span>
        </div>

        <div class="card" :class="{ 'card-condensed': !expandedIds.has(entry.id) }">
          <button
            v-if="!expandedIds.has(entry.id)"
            type="button"
            class="condensed-trigger"
            @click="toggleExpanded(entry.id)"
          >
            <div class="entry-header">
              <h3>{{ formatDate(entry.performed_at) }}</h3>
              <span v-if="entry.workout_templates" class="template-tag">{{ entry.workout_templates.name }}</span>
            </div>
            <p class="condensed-summary">{{ exerciseSummary(entry) }}</p>
            <svg class="condensed-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none">
              <path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          </button>

          <template v-else>
            <div class="entry-header">
              <h3>{{ formatDate(entry.performed_at) }}</h3>
              <div class="entry-header-actions">
                <span v-if="entry.workout_templates" class="template-tag">{{ entry.workout_templates.name }}</span>
                <button
                  type="button"
                  class="icon-button"
                  aria-label="Collapse details"
                  @click="toggleExpanded(entry.id)"
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
                    <path d="M6 15l6-6 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="icon-button delete-trigger"
                  aria-label="Delete workout"
                  @click="confirmingDeleteId = entry.id"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <line x1="10" y1="11" x2="10" y2="17" />
                    <line x1="14" y1="11" x2="14" y2="17" />
                  </svg>
                </button>
              </div>
            </div>

            <div v-if="prWorkoutIds.has(entry.id)" class="pr-marker">
              <svg viewBox="0 0 24 24" width="13" height="13">
                <ellipse cx="12" cy="16" rx="5.5" ry="4.2" fill="var(--highlight)" />
                <ellipse cx="6" cy="9" rx="2.1" ry="2.6" fill="var(--highlight)" />
                <ellipse cx="11" cy="6.5" rx="2.1" ry="2.6" fill="var(--highlight)" />
                <ellipse cx="16.2" cy="7.5" rx="2" ry="2.5" fill="var(--highlight)" />
                <ellipse cx="19" cy="11.5" rx="1.8" ry="2.3" fill="var(--highlight)" />
              </svg>
              <span>PR set this workout</span>
            </div>

            <div v-if="editingNotesId !== entry.id" class="notes-row">
              <p v-if="entry.notes" class="notes">{{ entry.notes }}</p>
              <button type="button" class="ghost small" @click="startEditingNotes(entry)">
                {{ entry.notes ? 'Edit notes' : 'Add notes' }}
              </button>
            </div>
            <form v-else class="notes-form" @submit.prevent="saveNotes(entry.id)">
              <label :for="`history-notes-${entry.id}`">Notes</label>
              <textarea :id="`history-notes-${entry.id}`" v-model="notesDraft" rows="2" />
              <div class="notes-actions">
                <button type="submit">Save</button>
                <button type="button" class="ghost small" @click="editingNotesId = null">Cancel</button>
              </div>
            </form>

            <ul class="list">
              <li v-for="set in entry.sets" :key="set.id" class="row-wrap">
                <div class="row">
                  <span class="row-body">
                    <span class="row-title">{{ set.exercises?.name ?? 'Unknown' }}</span>
                    <span class="row-sub">
                      {{ set.reps }} × {{ set.weight }}{{ set.weight_unit }}
                      <template v-if="set.rpe !== null"> · RPE {{ set.rpe }}</template>
                    </span>
                  </span>
                  <div class="row-actions">
                    <button type="button" class="ghost small" @click="startEditingSet(set)">Edit</button>
                    <button type="button" class="ghost small" @click="handleDeleteSet(set.id)">Delete</button>
                  </div>
                </div>

                <form v-if="editingSetId === set.id" class="set-edit-form" @submit.prevent="saveSetEdit(set.id)">
                  <div class="grid-2">
                    <div>
                      <label :for="`history-edit-reps-${set.id}`">Reps</label>
                      <input
                        :id="`history-edit-reps-${set.id}`"
                        v-model.number="editReps"
                        type="number"
                        inputmode="numeric"
                        min="1"
                        required
                      />
                    </div>
                    <div>
                      <label :for="`history-edit-weight-${set.id}`">Weight</label>
                      <input
                        :id="`history-edit-weight-${set.id}`"
                        v-model.number="editWeight"
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
                      <label :for="`history-edit-unit-${set.id}`">Unit</label>
                      <select :id="`history-edit-unit-${set.id}`" v-model="editWeightUnit">
                        <option value="lb">lb</option>
                        <option value="kg">kg</option>
                      </select>
                    </div>
                    <div>
                      <label :for="`history-edit-rpe-${set.id}`">RPE (optional)</label>
                      <input
                        :id="`history-edit-rpe-${set.id}`"
                        v-model.number="editRpe"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        max="10"
                        step="0.5"
                      />
                    </div>
                  </div>
                  <div class="set-edit-actions">
                    <button type="submit">Save</button>
                    <button type="button" class="ghost small" @click="editingSetId = null">Cancel</button>
                  </div>
                </form>
              </li>
            </ul>

            <div v-if="confirmingDeleteId === entry.id" class="confirm-delete">
              <span class="row-sub">Delete this workout? This can't be undone.</span>
              <div class="confirm-actions">
                <button type="button" class="danger small" @click="confirmDelete(entry.id)">Confirm delete</button>
                <button type="button" class="ghost small" @click="confirmingDeleteId = null">Cancel</button>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.timeline-row {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
}

.timeline-row:last-child {
  margin-bottom: 0;
}

.rail {
  width: 2px;
  flex-shrink: 0;
  position: relative;
}

.dot {
  position: absolute;
  top: 6px;
  left: -4px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
}

.dot-pr {
  background: var(--highlight);
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--highlight) 18%, transparent);
}

.rail-line {
  display: block;
  width: 2px;
  height: 100%;
  background: var(--border);
}

.card {
  position: relative;
  flex: 1;
  min-width: 0;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.card-condensed {
  opacity: 0.65;
}

.condensed-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  min-height: auto;
  cursor: pointer;
  position: relative;
}

.condensed-chevron {
  position: absolute;
  top: 2px;
  right: 0;
  color: var(--text-dim);
}

.condensed-summary {
  margin: 8px 0 0;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.entry-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  flex-wrap: wrap;
  margin-bottom: 4px;
  padding-right: 24px;
}

.entry-header h3 {
  margin: 0;
  color: var(--text);
}

.entry-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.template-tag {
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  border-radius: 999px;
  padding: 4px 10px;
  flex-shrink: 0;
}

.pr-marker {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 6px 0 0;
  font-size: 0.72rem;
  font-weight: 800;
  color: var(--highlight);
}

.notes-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin: 12px 0;
}

.notes {
  margin: 0;
}

.notes-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 12px 0;
}

.notes-actions {
  display: flex;
  gap: 8px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 4px;
}

.row-wrap {
  padding: 8px 0;
  border-top: 1px solid var(--border);
}

.row-wrap:first-child {
  border-top: none;
}

.row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px 12px;
}

.row-body {
  display: flex;
  flex-direction: column;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.85rem;
  color: var(--text-dim);
}

.row-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.grid-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.set-edit-form {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.set-edit-actions {
  display: flex;
  gap: 8px;
}

.error {
  color: var(--danger);
}

.empty {
  text-align: center;
  padding: 32px 0;
}

.icon-button {
  width: 30px;
  height: 30px;
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

.icon-button:hover,
.icon-button:focus-visible {
  color: var(--text);
}

.delete-trigger:hover,
.delete-trigger:focus-visible {
  color: var(--danger);
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
