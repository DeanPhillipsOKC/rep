<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useExercisesStore } from '../stores/exercises'
import { useTemplatesStore } from '../stores/templates'
import SkeletonRows from './SkeletonRows.vue'

const exercises = useExercisesStore()
const templates = useTemplatesStore()

const name = ref('')
const errorMessage = ref('')
const expandedId = ref<string | null>(null)

// Backlog item 54: the create form used to be a permanent card pinned above
// the list, eating space on every visit even though adding a template is
// rare compared to browsing/logging against existing ones. It now opens
// on demand as a dialog, same "sheet with a backdrop" shape as
// RecordCelebration.vue's overlay.
const showAddForm = ref(false)

function openAddForm() {
  errorMessage.value = ''
  name.value = ''
  showAddForm.value = true
}

function closeAddForm() {
  showAddForm.value = false
}

function handleAddFormKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showAddForm.value) closeAddForm()
}

onMounted(() => document.addEventListener('keydown', handleAddFormKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleAddFormKeydown))

const exerciseId = ref('')
const targetSets = ref<number | null>(null)

// Backlog item 35: id of the row showing its "are you sure" archive confirm
// — null means none. Same inline-toggle pattern as WorkoutHistory.vue's
// delete confirm, since archiving here has no restore path (see item 24's
// still-open human decision).
const confirmingArchiveId = ref<string | null>(null)

async function confirmArchive(templateId: string) {
  errorMessage.value = ''
  const { error } = await templates.archiveTemplate(templateId)
  if (error) {
    errorMessage.value = error.message
  }
  confirmingArchiveId.value = null
}

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
    showAddForm.value = false
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

// Backlog item 46: each card gets an icon + accent tint so templates read
// as distinct at a glance rather than a plain name list. There's no
// per-template category to derive these from (docs/backlog-archive.md item
// 30 dropped `exercises.category`), so both are assigned by hashing the
// template's id against a fixed palette — deterministic and stable across
// re-fetches/re-sorts, unlike an index into the current (sorted) list.
const templatePalette = [
  { varName: '--accent', icon: 'barbell' },
  { varName: '--secondary', icon: 'legs' },
  { varName: '--success', icon: 'flame' },
  { varName: '--highlight', icon: 'target' },
] as const

function paletteFor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return templatePalette[hash % templatePalette.length]
}

// Backlog item 75: workout_template_exercises(count) is a cached aggregate
// fetched once by fetchTemplates() and never updated by
// addExerciseToTemplate/removeExerciseFromTemplate, so it goes stale as soon
// as either mutates a template whose exercises have been expanded this
// session. exercisesByTemplate is kept live by both, so prefer its length
// once toggleExpand has populated it; fall back to the cached count for a
// template that hasn't been expanded yet.
function exerciseCount(template: { id: string; workout_template_exercises?: { count: number }[] }): number {
  const live = templates.exercisesByTemplate[template.id]
  if (live) return live.length
  return template.workout_template_exercises?.[0]?.count ?? 0
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

    <button v-if="!showAddForm" type="button" class="add-template-trigger" @click="openAddForm">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      Add template
    </button>

    <div v-if="showAddForm" class="sheet-overlay" role="dialog" aria-modal="true" aria-label="Add template" @click.self="closeAddForm">
      <form class="card sheet-card" @submit.prevent="handleCreate">
        <label for="template-name">Name</label>
        <input id="template-name" v-model="name" type="text" placeholder="e.g. Push Day" required autofocus />
        <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
        <div class="sheet-actions">
          <button type="submit">Add template</button>
          <button type="button" class="ghost small" @click="closeAddForm">Cancel</button>
        </div>
      </form>
    </div>

    <p v-if="!showAddForm && errorMessage" class="error">{{ errorMessage }}</p>
    <SkeletonRows v-if="templates.loading" :rows="3" />

    <ul v-else class="list">
      <li v-for="template in templates.activeTemplates" :key="template.id" class="row-wrap">
        <div v-if="confirmingArchiveId !== template.id" class="row" @click="toggleExpand(template.id)">
          <span
            class="template-icon"
            :style="{
              background: `color-mix(in srgb, var(${paletteFor(template.id).varName}) 16%, transparent)`,
              color: `var(${paletteFor(template.id).varName})`,
            }"
          >
            <svg v-if="paletteFor(template.id).icon === 'barbell'" viewBox="0 0 24 24" width="22" height="22" fill="none">
              <rect x="2.5" y="9.5" width="3" height="5" rx="1" fill="currentColor" />
              <rect x="18.5" y="9.5" width="3" height="5" rx="1" fill="currentColor" />
              <rect x="5.5" y="8" width="2.4" height="8" rx="1" fill="currentColor" />
              <rect x="16" y="8" width="2.4" height="8" rx="1" fill="currentColor" />
              <rect x="8" y="11" width="8" height="2" rx="1" fill="currentColor" />
            </svg>
            <svg v-else-if="paletteFor(template.id).icon === 'legs'" viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M8 4v6l-2.5 8a2 2 0 001.9 2.6h9.2a2 2 0 001.9-2.6L16 10V4"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linejoin="round"
              />
              <path d="M8 4h8M6 15h12" stroke="currentColor" stroke-width="1.7" />
            </svg>
            <svg v-else-if="paletteFor(template.id).icon === 'flame'" viewBox="0 0 24 24" width="22" height="22" fill="none">
              <path
                d="M12 3c1 3-2.5 4-2.5 7a2.5 2.5 0 005 0c0-1.2-.6-1.8-1-2.5 2 .5 4 2.7 4 5.5a5.5 5.5 0 11-11 0c0-4 2.5-6 3-7.5.3-1 .5-1.8 1.5-2.5z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
            <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none">
              <circle cx="12" cy="12" r="8" stroke="currentColor" stroke-width="1.6" />
              <circle cx="12" cy="12" r="4.5" stroke="currentColor" stroke-width="1.6" />
              <circle cx="12" cy="12" r="1.4" fill="currentColor" />
            </svg>
          </span>
          <span class="row-body">
            <span class="row-title">{{ template.name }}</span>
            <span class="row-sub">{{ exerciseCount(template) }} exercise{{ exerciseCount(template) === 1 ? '' : 's' }}</span>
          </span>
          <button
            type="button"
            class="archive-icon-btn"
            aria-label="Archive template"
            @click.stop="confirmingArchiveId = template.id"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none">
              <rect x="4" y="5" width="16" height="4" rx="1.3" stroke="currentColor" stroke-width="1.7" />
              <path
                d="M5.5 9.5V17a1.6 1.6 0 001.6 1.6h9.8A1.6 1.6 0 0018.5 17V9.5"
                stroke="currentColor"
                stroke-width="1.7"
              />
              <path d="M10 13h4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" />
            </svg>
          </button>
        </div>
        <div v-else class="row confirm-archive">
          <span class="row-sub">Archive this template? This can't be undone.</span>
          <div class="confirm-actions">
            <button type="button" class="danger small" @click="confirmArchive(template.id)">Confirm archive</button>
            <button type="button" class="ghost small" @click="confirmingArchiveId = null">Cancel</button>
          </div>
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

.add-template-trigger {
  width: 100%;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.add-template-trigger:active {
  background: var(--accent-pressed);
  border-color: var(--accent-pressed);
}

.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
}

.sheet-card {
  width: 100%;
  max-width: 480px;
  margin-bottom: 20px;
}

.sheet-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.sheet-actions button[type='submit'] {
  margin-top: 0;
}

.sheet-actions .ghost {
  flex-shrink: 0;
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

.template-icon {
  flex-shrink: 0;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.archive-icon-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  min-height: 0;
  padding: 0;
  border-radius: 11px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
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

.confirm-archive {
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
