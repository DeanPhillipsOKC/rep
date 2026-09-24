<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { useTemplatesStore } from '../stores/templates'

const exercises = useExercisesStore()
const templates = useTemplatesStore()

const name = ref('')
const errorMessage = ref('')
const expandedId = ref<string | null>(null)

const exerciseId = ref('')
const targetSets = ref<number | null>(null)

onMounted(() => {
  templates.fetchTemplates()
  if (exercises.exercises.length === 0) exercises.fetchExercises()
})

async function handleCreate() {
  errorMessage.value = ''
  const { error } = await templates.createTemplate(name.value)
  if (error) {
    errorMessage.value = error.message
  } else {
    name.value = ''
  }
}

async function toggleExpand(templateId: string) {
  if (expandedId.value === templateId) {
    expandedId.value = null
    return
  }
  expandedId.value = templateId
  exerciseId.value = ''
  targetSets.value = null
  if (!templates.exercisesByTemplate[templateId]) {
    await templates.fetchTemplateExercises(templateId)
  }
}

// Backlog item 12: same race as WorkoutLogger's addingSet (item 11) — without
// this, a second "Add" tap can fire before the first insert commits, racing
// over the network. Disabling the button for the duration of the request
// makes overlapping submissions impossible rather than just unlikely.
const addingExercise = ref(false)

// Target sets is optional, so its input has no `required` guard — like
// WorkoutLogger.vue's RPE field, v-model.number leaves an emptied field as
// '' rather than coercing it to null, and that '' sent straight through to
// Postgres's numeric target_sets column throws "invalid input syntax for
// type numeric".
function normalizeTargetSets(value: number | null): number | null {
  return (value as unknown) === '' ? null : value
}

async function handleAddExercise(templateId: string) {
  errorMessage.value = ''
  if (!exerciseId.value) return
  addingExercise.value = true
  const { error } = await templates.addExerciseToTemplate(
    templateId,
    exerciseId.value,
    normalizeTargetSets(targetSets.value),
  )
  addingExercise.value = false
  if (error) {
    errorMessage.value = error.message
  } else {
    exerciseId.value = ''
    targetSets.value = null
  }
}

function exerciseName(id: string): string {
  return exercises.exercises.find((e) => e.id === id)?.name ?? 'Unknown'
}

// Backlog item 25 follow-up: checks the live exercises store rather than
// te.exercises.is_archived from the cached join — that join is a snapshot
// from whenever this template's exercises were last fetched (only once per
// session, see toggleExpand), so it goes stale the moment an exercise still
// attached here gets archived later in the same session.
function isExerciseArchived(id: string): boolean {
  return exercises.exercises.find((e) => e.id === id)?.is_archived ?? false
}

// Backlog item 14: inline edit for an exercise's target set count, same
// pattern as WorkoutLogger.vue's set editor — one row's id tracked here,
// null means no row is being edited.
const editingExerciseId = ref<string | null>(null)
const editTargetSets = ref<number | null>(null)

function startEditingExercise(te: { id: string; target_sets: number | null }) {
  editingExerciseId.value = te.id
  editTargetSets.value = te.target_sets
}

async function saveExerciseEdit(templateId: string, templateExerciseId: string) {
  errorMessage.value = ''
  const { error } = await templates.updateTemplateExercise(
    templateId,
    templateExerciseId,
    normalizeTargetSets(editTargetSets.value),
  )
  if (error) {
    errorMessage.value = error.message
  } else {
    editingExerciseId.value = null
  }
}
</script>

<template>
  <div>
    <h2>Templates</h2>

    <form class="card" @submit.prevent="handleCreate">
      <label for="template-name">Name</label>
      <input id="template-name" v-model="name" type="text" placeholder="e.g. Push Day" required />
      <button type="submit">Add template</button>
    </form>

    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
    <p v-if="templates.loading">Loading…</p>

    <ul class="list">
      <li v-for="template in templates.activeTemplates" :key="template.id" class="row-wrap">
        <div class="row" @click="toggleExpand(template.id)">
          <span class="row-title">{{ template.name }}</span>
          <button type="button" class="ghost small" @click.stop="templates.archiveTemplate(template.id)">
            Archive
          </button>
        </div>

        <div v-if="expandedId === template.id" class="expanded">
          <ol class="exercise-list">
            <li v-for="(te, index) in templates.exercisesByTemplate[template.id]" :key="te.id" class="exercise-row-wrap">
              <div class="exercise-row">
                <span class="row-index">{{ index + 1 }}</span>
                <span class="row-body">
                  <span class="row-title">
                    {{ te.exercises?.name ?? exerciseName(te.exercise_id) }}
                    <span v-if="isExerciseArchived(te.exercise_id)" class="archived-tag">Archived</span>
                  </span>
                  <span v-if="te.target_sets" class="row-sub">{{ te.target_sets }} sets</span>
                </span>
                <span class="reorder">
                  <button
                    type="button"
                    class="ghost small"
                    :disabled="index === 0"
                    @click="templates.moveExercise(template.id, te.id, 'up')"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    class="ghost small"
                    :disabled="index === (templates.exercisesByTemplate[template.id]?.length ?? 0) - 1"
                    @click="templates.moveExercise(template.id, te.id, 'down')"
                  >
                    ↓
                  </button>
                  <button type="button" class="ghost small" @click="startEditingExercise(te)">Edit</button>
                  <button
                    type="button"
                    class="ghost small"
                    @click="templates.removeExerciseFromTemplate(template.id, te.id)"
                  >
                    Remove
                  </button>
                </span>
              </div>

              <form
                v-if="editingExerciseId === te.id"
                class="exercise-edit-form"
                @submit.prevent="saveExerciseEdit(template.id, te.id)"
              >
                <label :for="`edit-target-sets-${te.id}`">Target sets</label>
                <input
                  :id="`edit-target-sets-${te.id}`"
                  v-model.number="editTargetSets"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  class="sets-input"
                />
                <button type="submit">Save</button>
                <button type="button" class="ghost small" @click="editingExerciseId = null">Cancel</button>
              </form>
            </li>
          </ol>
          <p
            v-if="(templates.exercisesByTemplate[template.id]?.length ?? 0) === 0"
            class="empty"
          >
            No exercises in this template yet.
          </p>

          <form class="add-exercise" @submit.prevent="handleAddExercise(template.id)">
            <select v-model="exerciseId" required>
              <option value="" disabled>Select an exercise</option>
              <option v-for="exercise in exercises.activeExercises" :key="exercise.id" :value="exercise.id">
                {{ exercise.name }}
              </option>
            </select>
            <input
              v-model.number="targetSets"
              type="number"
              inputmode="numeric"
              min="1"
              placeholder="Sets"
              class="sets-input"
            />
            <button type="submit" :disabled="addingExercise">Add</button>
          </form>
        </div>
      </li>
    </ul>
    <p v-if="!templates.loading && templates.activeTemplates.length === 0" class="empty">
      No templates yet. Add one above.
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
  overflow: hidden;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
}

.row-title {
  font-weight: 600;
}

.row-sub {
  font-size: 0.8rem;
  color: var(--text-dim);
}

.archived-tag {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 1px 6px;
  margin-left: 4px;
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

.expanded {
  border-top: 1px solid var(--border);
  padding: 12px 14px;
  background: var(--surface-2);
}

.exercise-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.exercise-row-wrap {
  display: flex;
  flex-direction: column;
}

.exercise-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.exercise-edit-form {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding-left: 36px;
}

.exercise-edit-form button {
  width: auto;
  margin-top: 0;
  flex-shrink: 0;
}

.row-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: var(--surface);
  color: var(--text-dim);
  font-size: 0.75rem;
}

.row-body {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
}

.reorder {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.add-exercise {
  display: flex;
  gap: 8px;
}

.add-exercise select {
  flex-grow: 1;
}

.sets-input {
  width: 70px;
}

.add-exercise button {
  width: auto;
  margin-top: 0;
  flex-shrink: 0;
}

.empty {
  text-align: center;
  padding: 12px 0;
}
</style>
