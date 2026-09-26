<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { usePushSubscriptionStore } from '../stores/pushSubscription'
import ExerciseHistoryDetail from './ExerciseHistoryDetail.vue'
import type { Exercise } from '../lib/types'

const exercises = useExercisesStore()
const push = usePushSubscriptionStore()

// Backlog item 1: id of the exercise whose history overlay is open, null
// means none.
const viewingHistoryFor = ref<string | null>(null)
const name = ref('')
const setupNotes = ref('')
const restSeconds = ref<number | null>(null)
const errorMessage = ref('')
const enablingPush = ref(false)

// Backlog item 24: one consolidated edit flyout per row (name, setup notes,
// and rest timer together) behind a single pencil icon, replacing three
// separate text-button editors that only grew wordier as fields were added
// (item 22). Id of the row currently open — null means none.
const editingId = ref<string | null>(null)
const nameDraft = ref('')
const notesDraft = ref('')
const restDraft = ref<number | null>(null)

// Backlog item 24 decision (docs/backlog-archive.md, 2026-09-24): "Archive"
// had no restore path anywhere in the UI, so it behaved exactly like a
// permanent delete already — the DB still soft-deletes via `is_archived`
// (needed so removing an exercise doesn't break the FK reference from
// existing sets/workout_template_exercises rows), but the UI now calls it
// what it is and requires an explicit confirm step, same inline-toggle
// pattern as WorkoutHistory.vue's workout delete (item 31).
const confirmingDeleteId = ref<string | null>(null)

onMounted(() => {
  exercises.fetchExercises()
  push.refreshStatus()
})

async function handleEnablePush() {
  enablingPush.value = true
  try {
    await push.enable()
  } finally {
    enablingPush.value = false
  }
}

async function handleCreate() {
  errorMessage.value = ''
  // v-model.number leaves an emptied input as '' rather than null/NaN.
  const seconds = restSeconds.value && restSeconds.value > 0 ? restSeconds.value : null
  const { error } = await exercises.createExercise(
    name.value,
    setupNotes.value.trim() || null,
    seconds,
  )
  if (error) {
    errorMessage.value = error.message
  } else {
    name.value = ''
    setupNotes.value = ''
    restSeconds.value = null
  }
}

function startEditing(exercise: Exercise) {
  editingId.value = exercise.id
  nameDraft.value = exercise.name
  notesDraft.value = exercise.setup_notes ?? ''
  restDraft.value = exercise.rest_seconds
}

async function saveEdit(id: string) {
  errorMessage.value = ''
  const trimmedName = nameDraft.value.trim()
  if (!trimmedName) {
    errorMessage.value = 'Name cannot be empty.'
    return
  }
  // v-model.number leaves an emptied input as '' rather than null/NaN.
  const seconds = restDraft.value && restDraft.value > 0 ? restDraft.value : null
  const { error } = await exercises.updateExercise(id, trimmedName, notesDraft.value.trim() || null, seconds)
  if (error) {
    errorMessage.value = error.message
  } else {
    editingId.value = null
  }
}

async function confirmDelete(id: string) {
  errorMessage.value = ''
  const { error } = await exercises.archiveExercise(id)
  if (error) {
    errorMessage.value = error.message
  }
  confirmingDeleteId.value = null
}
</script>

<template>
  <div>
    <h2>Exercises</h2>

    <!-- Backlog item 17: once already enabled, this device doesn't need the
         full card taking up space above the exercise list on every visit —
         just a one-line confirmation. Item 47: restyled as a pill/banner
         (var(--success) tint) instead of plain caption text. -->
    <p v-if="push.subscribed" class="push-enabled-note">
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
        <path d="M12 8v5M12 16h.01" stroke="var(--success)" stroke-width="2" stroke-linecap="round" />
        <circle cx="12" cy="12" r="8.5" stroke="var(--success)" stroke-width="1.6" />
      </svg>
      Rest timer alerts are enabled on this device.
    </p>
    <div v-else class="card push-card">
      <h3>Rest timer alerts</h3>
      <p class="row-sub">
        Notifies you when a per-exercise rest timer runs out, even if your phone is locked.
        Configure a duration on any exercise below, then enable alerts on each device you
        use to log workouts.
      </p>
      <p v-if="!push.supported" class="row-sub">
        Not supported on this device/browser. On iPhone, add this app to the home screen
        first (Share → Add to Home Screen), then open it from there.
      </p>
      <button v-else type="button" :disabled="enablingPush" @click="handleEnablePush">
        Enable rest timer alerts
      </button>
      <p v-if="push.errorMessage" class="error">{{ push.errorMessage }}</p>
    </div>

    <form class="card" @submit.prevent="handleCreate">
      <label for="exercise-name">Name</label>
      <input id="exercise-name" v-model="name" type="text" required />

      <label for="exercise-notes">Setup notes</label>
      <textarea
        id="exercise-notes"
        v-model="setupNotes"
        rows="2"
        placeholder="e.g. seat height 4, incline 30°"
      />

      <label for="exercise-rest">Rest timer (seconds)</label>
      <input
        id="exercise-rest"
        v-model.number="restSeconds"
        type="number"
        inputmode="numeric"
        min="1"
        placeholder="e.g. 90"
      />

      <button type="submit">Add exercise</button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="exercises.loading">Loading…</p>

    <ul class="list">
      <li v-for="exercise in exercises.activeExercises" :key="exercise.id" class="row-wrap">
        <div v-if="confirmingDeleteId !== exercise.id" class="row">
          <div>
            <div class="row-title">{{ exercise.name }}</div>
            <div v-if="editingId !== exercise.id" class="row-tags">
              <span v-if="exercise.setup_notes" class="tag-pill">{{ exercise.setup_notes }}</span>
              <span v-if="exercise.rest_seconds" class="tag-pill tag-pill-accent">Rest: {{ exercise.rest_seconds }}s</span>
            </div>
          </div>
          <div class="row-actions">
            <button
              type="button"
              class="icon-button"
              aria-label="View exercise history"
              @click="viewingHistoryFor = exercise.id"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="8.5" />
                <path d="M12 7.5V12l3 2" />
              </svg>
            </button>
            <button type="button" class="icon-button" aria-label="Edit exercise" @click="startEditing(exercise)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-button icon-button-danger"
              aria-label="Delete exercise"
              @click="confirmingDeleteId = exercise.id"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </div>
        <div v-else class="row confirm-delete">
          <span class="row-sub">Delete this exercise? This can't be undone.</span>
          <div class="confirm-actions">
            <button type="button" class="danger small" @click="confirmDelete(exercise.id)">Confirm delete</button>
            <button type="button" class="ghost small" @click="confirmingDeleteId = null">Cancel</button>
          </div>
        </div>

        <form v-if="editingId === exercise.id" class="notes-form" @submit.prevent="saveEdit(exercise.id)">
          <label :for="`edit-name-${exercise.id}`">Name</label>
          <input :id="`edit-name-${exercise.id}`" v-model="nameDraft" type="text" required />

          <label :for="`edit-notes-${exercise.id}`">Setup notes</label>
          <textarea
            :id="`edit-notes-${exercise.id}`"
            v-model="notesDraft"
            rows="2"
            placeholder="e.g. seat height 4, incline 30°"
          />

          <label :for="`edit-rest-${exercise.id}`">Rest timer (seconds)</label>
          <input
            :id="`edit-rest-${exercise.id}`"
            v-model.number="restDraft"
            type="number"
            inputmode="numeric"
            min="1"
            placeholder="e.g. 90"
          />

          <div class="notes-actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost small" @click="editingId = null">Cancel</button>
          </div>
        </form>
      </li>
    </ul>
    <p v-if="!exercises.loading && exercises.activeExercises.length === 0" class="empty">
      No exercises yet. Add one above before logging a workout.
    </p>

    <ExerciseHistoryDetail
      v-if="viewingHistoryFor"
      :exercise-id="viewingHistoryFor"
      @dismiss="viewingHistoryFor = null"
    />
  </div>
</template>

<style scoped>
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 20px;
}

.push-card h3 {
  margin-top: 0;
}

.push-card .row-sub {
  margin-bottom: 12px;
}

.push-enabled-note {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--success) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--success) 28%, transparent);
  font-size: 0.8rem;
  font-weight: 600;
  color: color-mix(in srgb, var(--success) 70%, var(--text));
}

.push-enabled-note svg {
  flex-shrink: 0;
}

.error {
  color: var(--danger);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.row-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.tag-pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--text-dim);
  font-size: 0.7rem;
  font-weight: 700;
  white-space: pre-wrap;
}

.tag-pill-accent {
  background: color-mix(in srgb, var(--accent) 14%, transparent);
  color: var(--accent);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
  flex-shrink: 0;
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
  color: var(--text);
}

.icon-button-danger:hover,
.icon-button-danger:focus-visible {
  color: var(--danger);
}

.confirm-delete {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.confirm-actions {
  display: flex;
  gap: 8px;
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

.notes-form {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.notes-actions {
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

.empty {
  text-align: center;
  padding: 32px 0;
}
</style>
