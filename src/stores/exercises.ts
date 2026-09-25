import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import type { Exercise } from '../lib/types'

// Per-user exercise catalog. See docs/architecture.md#data-model for why
// exercises aren't shared between the two users.
export const useExercisesStore = defineStore('exercises', () => {
  const exercises = ref<Exercise[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const activeExercises = computed(() => exercises.value.filter((e) => !e.is_archived))

  async function fetchExercises() {
    loading.value = true
    errorMessage.value = ''
    const { data, error } = await supabase.from('exercises').select('*').order('name')
    if (error) {
      errorMessage.value = error.message
    } else {
      exercises.value = data ?? []
    }
    loading.value = false
  }

  async function createExercise(
    name: string,
    setupNotes: string | null = null,
    restSeconds: number | null = null,
  ) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('exercises')
      .insert({ user_id: userId, name, setup_notes: setupNotes, rest_seconds: restSeconds })
      .select()
      .single()

    if (!error && data) {
      exercises.value.push(data)
    }
    return { data, error }
  }

  async function archiveExercise(id: string) {
    const { error } = await supabase.from('exercises').update({ is_archived: true }).eq('id', id)
    if (!error) {
      const exercise = exercises.value.find((e) => e.id === id)
      if (exercise) exercise.is_archived = true
    }
    return { error }
  }

  // Backlog item 24: name, setup notes, and rest timer are edited together
  // through one consolidated flyout now, so they're saved in a single write
  // instead of the three separate updateExerciseName/updateSetupNotes/
  // updateRestSeconds calls this replaced.
  async function updateExercise(
    id: string,
    name: string,
    setupNotes: string | null,
    restSeconds: number | null,
  ) {
    const { error } = await supabase
      .from('exercises')
      .update({ name, setup_notes: setupNotes, rest_seconds: restSeconds })
      .eq('id', id)
    if (!error) {
      const exercise = exercises.value.find((e) => e.id === id)
      if (exercise) {
        exercise.name = name
        exercise.setup_notes = setupNotes
        exercise.rest_seconds = restSeconds
      }
    }
    return { error }
  }

  return {
    exercises,
    activeExercises,
    loading,
    errorMessage,
    fetchExercises,
    createExercise,
    archiveExercise,
    updateExercise,
  }
})
