import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type { SetEntry, WeightUnit, WorkoutWithSets } from '../lib/types'

// Core logging flow per docs/architecture.md build order step 4:
// create workout -> add sets to it -> view history.
export const useWorkoutsStore = defineStore('workouts', () => {
  const history = ref<WorkoutWithSets[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const activeWorkoutId = ref<string | null>(null)
  const activeTemplateId = ref<string | null>(null)
  const activeSets = ref<SetEntry[]>([])
  const previousWorkout = ref<WorkoutWithSets | null>(null)

  // Backlog item 3: most recent past workout logged against this template
  // that actually has sets on it, so the logger can show what to beat.
  // `sets!inner` turns the embed into an inner join so workouts with zero
  // sets (e.g. started and finished without logging anything) are excluded
  // rather than winning on recency and showing an empty card. Called before
  // startWorkout so the just-created row can't show up as its own "previous"
  // workout.
  async function fetchPreviousWorkout(templateId: string) {
    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets!inner(*, exercises(name)), workout_templates(name)')
      .eq('template_id', templateId)
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })
      .limit(1)

    if (!error) {
      previousWorkout.value = (data?.[0] ?? null) as unknown as WorkoutWithSets | null
    }
    return { error }
  }

  async function startWorkout(notes: string | null = null, templateId: string | null = null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, notes, template_id: templateId })
      .select()
      .single()

    if (!error && data) {
      activeWorkoutId.value = data.id
      activeTemplateId.value = templateId
      activeSets.value = []
    }
    return { data, error }
  }

  async function addSet(
    exerciseId: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit,
    rpe: number | null
  ) {
    if (!activeWorkoutId.value) return { error: new Error('No active workout') }

    const { data, error } = await supabase
      .from('sets')
      .insert({
        workout_id: activeWorkoutId.value,
        exercise_id: exerciseId,
        set_index: activeSets.value.length,
        reps,
        weight,
        weight_unit: weightUnit,
        rpe,
      })
      .select()
      .single()

    if (!error && data) {
      activeSets.value.push(data)
    }
    return { data, error }
  }

  function finishWorkout() {
    activeWorkoutId.value = null
    activeTemplateId.value = null
    activeSets.value = []
    previousWorkout.value = null
  }

  async function fetchHistory() {
    loading.value = true
    errorMessage.value = ''
    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name)), workout_templates(name)')
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })

    if (error) {
      errorMessage.value = error.message
    } else {
      history.value = (data ?? []) as unknown as WorkoutWithSets[]
    }
    loading.value = false
  }

  return {
    history,
    loading,
    errorMessage,
    activeWorkoutId,
    activeTemplateId,
    activeSets,
    previousWorkout,
    startWorkout,
    addSet,
    finishWorkout,
    fetchHistory,
    fetchPreviousWorkout,
  }
})
