import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type { TemplateExerciseWithName, WorkoutTemplate } from '../lib/types'

// Templates sit above workouts/sets (docs/backlog.md item 2): a named,
// ordered list of exercises that a logged workout can be an instance of.
export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<WorkoutTemplate[]>([])
  const exercisesByTemplate = ref<Record<string, TemplateExerciseWithName[]>>({})
  const loading = ref(false)
  const errorMessage = ref('')

  // Backlog item 63: fetchTemplateExercises (kicked off by toggleExpand) and
  // addExerciseToTemplate (kicked off by the "Add" form right after expand)
  // both write to exercisesByTemplate[templateId] and can be in flight at
  // the same time. If the fetch's SELECT started before the add's INSERT
  // committed, it resolves with a stale, exercise-missing list and
  // overwrites the add's own optimistic update with it, briefly (or
  // permanently) hiding the just-added `.exercise-row`. Bumped by every
  // mutation below; fetchTemplateExercises only applies its result if
  // nothing else touched this template's list while it was in flight.
  const exercisesVersion = ref<Record<string, number>>({})
  function bumpExercisesVersion(templateId: string): number {
    const next = (exercisesVersion.value[templateId] ?? 0) + 1
    exercisesVersion.value[templateId] = next
    return next
  }

  const activeTemplates = computed(() => templates.value.filter((t) => !t.is_archived))

  async function fetchTemplates() {
    loading.value = true
    errorMessage.value = ''
    const { data, error } = await supabase
      .from('workout_templates')
      .select('*, workout_template_exercises(count)')
      .order('name')
    if (error) {
      errorMessage.value = error.message
    } else {
      templates.value = data ?? []
    }
    loading.value = false
  }

  async function createTemplate(name: string) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('workout_templates')
      .insert({ user_id: userId, name })
      .select()
      .single()

    if (!error && data) {
      templates.value.push(data)
    }
    return { data, error }
  }

  async function archiveTemplate(id: string) {
    const { error } = await supabase.from('workout_templates').update({ is_archived: true }).eq('id', id)
    if (!error) {
      const template = templates.value.find((t) => t.id === id)
      if (template) template.is_archived = true
    }
    return { error }
  }

  async function fetchTemplateExercises(templateId: string) {
    const requestVersion = bumpExercisesVersion(templateId)
    const { data, error } = await supabase
      .from('workout_template_exercises')
      .select('*, exercises(name, load_type)')
      .eq('template_id', templateId)
      .order('position')

    if (!error && exercisesVersion.value[templateId] === requestVersion) {
      exercisesByTemplate.value[templateId] = (data ?? []) as unknown as TemplateExerciseWithName[]
    }
    return { error }
  }

  async function addExerciseToTemplate(templateId: string, exerciseId: string, targetSets: number | null) {
    const list = exercisesByTemplate.value[templateId] ?? []
    const position = list.length === 0 ? 0 : Math.max(...list.map((e) => e.position)) + 1

    const { data, error } = await supabase
      .from('workout_template_exercises')
      .insert({ template_id: templateId, exercise_id: exerciseId, position, target_sets: targetSets })
      .select('*, exercises(name, load_type)')
      .single()

    if (!error && data) {
      exercisesByTemplate.value[templateId] = [...list, data as unknown as TemplateExerciseWithName]
      bumpExercisesVersion(templateId)
    }
    return { data, error }
  }

  // Backlog item 14: change a routine's target set count without removing
  // and re-adding the exercise (which would lose its position).
  async function updateTemplateExercise(templateId: string, templateExerciseId: string, targetSets: number | null) {
    const { error } = await supabase
      .from('workout_template_exercises')
      .update({ target_sets: targetSets })
      .eq('id', templateExerciseId)
    if (!error) {
      const list = exercisesByTemplate.value[templateId] ?? []
      const te = list.find((e) => e.id === templateExerciseId)
      if (te) te.target_sets = targetSets
      bumpExercisesVersion(templateId)
    }
    return { error }
  }

  async function removeExerciseFromTemplate(templateId: string, templateExerciseId: string) {
    const { error } = await supabase.from('workout_template_exercises').delete().eq('id', templateExerciseId)
    if (!error) {
      const list = exercisesByTemplate.value[templateId] ?? []
      exercisesByTemplate.value[templateId] = list.filter((e) => e.id !== templateExerciseId)
      bumpExercisesVersion(templateId)
    }
    return { error }
  }

  // Swaps this exercise's position with its neighbor in `direction` and
  // persists both rows. Simple reordering; no drag-and-drop.
  async function moveExercise(templateId: string, templateExerciseId: string, direction: 'up' | 'down') {
    const list = exercisesByTemplate.value[templateId] ?? []
    const index = list.findIndex((e) => e.id === templateExerciseId)
    const swapWith = direction === 'up' ? index - 1 : index + 1
    if (index === -1 || swapWith < 0 || swapWith >= list.length) return { error: null }

    const a = list[index]
    const b = list[swapWith]
    const [aPos, bPos] = [b.position, a.position]

    const { error } = await supabase
      .from('workout_template_exercises')
      .upsert([
        { id: a.id, template_id: templateId, exercise_id: a.exercise_id, position: aPos, target_sets: a.target_sets },
        { id: b.id, template_id: templateId, exercise_id: b.exercise_id, position: bPos, target_sets: b.target_sets },
      ])

    if (!error) {
      a.position = aPos
      b.position = bPos
      list.sort((x, y) => x.position - y.position)
      exercisesByTemplate.value[templateId] = [...list]
      bumpExercisesVersion(templateId)
    }
    return { error }
  }

  // Item 84: sign-out (AuthGate.vue) — same app-lifetime-singleton concern
  // as exercises.ts's resetExercisesState. TemplateManager.vue's own mount
  // fetch is unconditional, but WorkoutLogger.vue's exercisesByTemplate
  // reads for the active template aren't refetched on their own, so a
  // stale entry from the previous account could otherwise surface there.
  function resetTemplatesState() {
    templates.value = []
    exercisesByTemplate.value = {}
    exercisesVersion.value = {}
    errorMessage.value = ''
  }

  return {
    templates,
    activeTemplates,
    exercisesByTemplate,
    loading,
    errorMessage,
    fetchTemplates,
    createTemplate,
    archiveTemplate,
    fetchTemplateExercises,
    addExerciseToTemplate,
    updateTemplateExercise,
    removeExerciseFromTemplate,
    moveExercise,
    resetTemplatesState,
  }
})
