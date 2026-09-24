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

async function handleAddExercise(templateId: string) {
  errorMessage.value = ''
  if (!exerciseId.value) return
  addingExercise.value = true
  const { error } = await templates.addExerciseToTemplate(templateId, exerciseId.value, targetSets.value)
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
            <li v-for="(te, index) in templates.exercisesByTemplate[template.id]" :key="te.id" class="exercise-row">
              <span class="row-index">{{ index + 1 }}</span>
              <span class="row-body">
                <span class="row-title">{{ te.exercises?.name ?? exerciseName(te.exercise_id) }}</span>
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
                <button
                  type="button"
                  class="ghost small"
                  @click="templates.removeExerciseFromTemplate(template.id, te.id)"
                >
                  Remove
                </button>
              </span>
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

.exercise-row {
  display: flex;
  align-items: center;
  gap: 12px;
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
