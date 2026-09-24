<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { usePushSubscriptionStore } from '../stores/pushSubscription'

const exercises = useExercisesStore()
const push = usePushSubscriptionStore()
const name = ref('')
const category = ref('')
const setupNotes = ref('')
const restSeconds = ref<number | null>(null)
const errorMessage = ref('')
const enablingPush = ref(false)

// Exercise id currently showing its setup-notes editor, and the draft text
// for it — null means no row is being edited.
const editingNotesId = ref<string | null>(null)
const notesDraft = ref('')

// Same pattern for renaming an exercise.
const editingNameId = ref<string | null>(null)
const nameDraft = ref('')

// Same pattern again for the per-exercise rest timer duration (backlog item 15).
const editingRestId = ref<string | null>(null)
const restDraft = ref<number | null>(null)

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
    category.value || null,
    setupNotes.value.trim() || null,
    seconds,
  )
  if (error) {
    errorMessage.value = error.message
  } else {
    name.value = ''
    category.value = ''
    setupNotes.value = ''
    restSeconds.value = null
  }
}

function startEditingNotes(id: string, currentNotes: string | null) {
  editingNotesId.value = id
  notesDraft.value = currentNotes ?? ''
}

async function saveNotes(id: string) {
  errorMessage.value = ''
  const { error } = await exercises.updateSetupNotes(id, notesDraft.value.trim() || null)
  if (error) {
    errorMessage.value = error.message
  } else {
    editingNotesId.value = null
  }
}

function startEditingName(id: string, currentName: string) {
  editingNameId.value = id
  nameDraft.value = currentName
}

async function saveName(id: string) {
  errorMessage.value = ''
  const trimmed = nameDraft.value.trim()
  if (!trimmed) {
    errorMessage.value = 'Name cannot be empty.'
    return
  }
  const { error } = await exercises.updateExerciseName(id, trimmed)
  if (error) {
    errorMessage.value = error.message
  } else {
    editingNameId.value = null
  }
}

function startEditingRest(id: string, currentRestSeconds: number | null) {
  editingRestId.value = id
  restDraft.value = currentRestSeconds
}

async function saveRest(id: string) {
  errorMessage.value = ''
  // v-model.number leaves an emptied input as '' rather than null/NaN.
  const seconds = restDraft.value && restDraft.value > 0 ? restDraft.value : null
  const { error } = await exercises.updateRestSeconds(id, seconds)
  if (error) {
    errorMessage.value = error.message
  } else {
    editingRestId.value = null
  }
}
</script>

<template>
  <div>
    <h2>Exercises</h2>

    <!-- Backlog item 17: once already enabled, this device doesn't need the
         full card taking up space above the exercise list on every visit —
         just a one-line confirmation. -->
    <p v-if="push.subscribed" class="row-sub push-enabled-note">Rest timer alerts are enabled on this device.</p>
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

      <label for="exercise-category">Category</label>
      <input id="exercise-category" v-model="category" type="text" list="categories" />
      <datalist id="categories">
        <option value="push" />
        <option value="pull" />
        <option value="legs" />
        <option value="cardio" />
      </datalist>

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
        <div class="row">
          <div>
            <div class="row-title">{{ exercise.name }}</div>
            <div v-if="exercise.category" class="row-sub">{{ exercise.category }}</div>
            <div v-if="exercise.setup_notes && editingNotesId !== exercise.id" class="row-notes">
              {{ exercise.setup_notes }}
            </div>
            <div v-if="exercise.rest_seconds && editingRestId !== exercise.id" class="row-sub">
              Rest: {{ exercise.rest_seconds }}s
            </div>
          </div>
          <div class="row-actions">
            <button
              v-if="editingNameId !== exercise.id"
              type="button"
              class="ghost small"
              @click="startEditingName(exercise.id, exercise.name)"
            >
              Edit name
            </button>
            <button
              type="button"
              class="ghost small"
              @click="startEditingNotes(exercise.id, exercise.setup_notes)"
            >
              {{ exercise.setup_notes ? 'Edit notes' : 'Add notes' }}
            </button>
            <button
              type="button"
              class="ghost small"
              @click="startEditingRest(exercise.id, exercise.rest_seconds)"
            >
              {{ exercise.rest_seconds ? 'Edit rest timer' : 'Add rest timer' }}
            </button>
            <button type="button" class="ghost small" @click="exercises.archiveExercise(exercise.id)">
              Archive
            </button>
          </div>
        </div>

        <form v-if="editingNameId === exercise.id" class="notes-form" @submit.prevent="saveName(exercise.id)">
          <label :for="`name-${exercise.id}`">Name</label>
          <input :id="`name-${exercise.id}`" v-model="nameDraft" type="text" required />
          <div class="notes-actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost small" @click="editingNameId = null">Cancel</button>
          </div>
        </form>

        <form v-if="editingNotesId === exercise.id" class="notes-form" @submit.prevent="saveNotes(exercise.id)">
          <label :for="`notes-${exercise.id}`">Setup notes</label>
          <textarea
            :id="`notes-${exercise.id}`"
            v-model="notesDraft"
            rows="2"
            placeholder="e.g. seat height 4, incline 30°"
          />
          <div class="notes-actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost small" @click="editingNotesId = null">Cancel</button>
          </div>
        </form>

        <form v-if="editingRestId === exercise.id" class="notes-form" @submit.prevent="saveRest(exercise.id)">
          <label :for="`rest-${exercise.id}`">Rest timer (seconds)</label>
          <input
            :id="`rest-${exercise.id}`"
            v-model.number="restDraft"
            type="number"
            inputmode="numeric"
            min="1"
            placeholder="e.g. 90"
          />
          <div class="notes-actions">
            <button type="submit">Save</button>
            <button type="button" class="ghost small" @click="editingRestId = null">Cancel</button>
          </div>
        </form>
      </li>
    </ul>
    <p v-if="!exercises.loading && exercises.activeExercises.length === 0" class="empty">
      No exercises yet. Add one above before logging a workout.
    </p>
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
  margin: 0 0 12px;
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

.row-notes {
  font-size: 0.8rem;
  color: var(--text-dim);
  margin-top: 4px;
  white-space: pre-wrap;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
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
