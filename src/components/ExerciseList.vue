<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'

const exercises = useExercisesStore()
const name = ref('')
const category = ref('')
const errorMessage = ref('')

// Exercise id currently showing its setup-notes editor, and the draft text
// for it — null means no row is being edited.
const editingNotesId = ref<string | null>(null)
const notesDraft = ref('')

onMounted(() => {
  exercises.fetchExercises()
})

async function handleCreate() {
  errorMessage.value = ''
  const { error } = await exercises.createExercise(name.value, category.value || null)
  if (error) {
    errorMessage.value = error.message
  } else {
    name.value = ''
    category.value = ''
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
</script>

<template>
  <div>
    <h2>Exercises</h2>

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
          </div>
          <div class="row-actions">
            <button
              type="button"
              class="ghost small"
              @click="startEditingNotes(exercise.id, exercise.setup_notes)"
            >
              {{ exercise.setup_notes ? 'Edit notes' : 'Add notes' }}
            </button>
            <button type="button" class="ghost small" @click="exercises.archiveExercise(exercise.id)">
              Archive
            </button>
          </div>
        </div>

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
  gap: 8px;
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
