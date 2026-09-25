<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useWorkoutsStore } from '../stores/workouts'
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

.notes-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}

.notes {
  margin: 0;
}

.notes-form {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
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
