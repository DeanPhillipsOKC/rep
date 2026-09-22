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
  const activeSets = ref<SetEntry[]>([])

  async function startWorkout(notes: string | null = null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, notes })
      .select()
      .single()

    if (!error && data) {
      activeWorkoutId.value = data.id
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
    activeSets.value = []
  }

  async function fetchHistory() {
    loading.value = true
    errorMessage.value = ''
    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name))')
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
    activeSets,
    startWorkout,
    addSet,
    finishWorkout,
    fetchHistory,
  }
})
