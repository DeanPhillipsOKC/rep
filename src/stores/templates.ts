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
    const { data, error } = await supabase
      .from('workout_template_exercises')
      .select('*, exercises(name)')
      .eq('template_id', templateId)
      .order('position')

    if (!error) {
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
      .select('*, exercises(name)')
      .single()

    if (!error && data) {
      exercisesByTemplate.value[templateId] = [...list, data as unknown as TemplateExerciseWithName]
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
    }
    return { error }
  }

  async function removeExerciseFromTemplate(templateId: string, templateExerciseId: string) {
    const { error } = await supabase.from('workout_template_exercises').delete().eq('id', templateExerciseId)
    if (!error) {
      const list = exercisesByTemplate.value[templateId] ?? []
      exercisesByTemplate.value[templateId] = list.filter((e) => e.id !== templateExerciseId)
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
    }
    return { error }
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
  }
})
