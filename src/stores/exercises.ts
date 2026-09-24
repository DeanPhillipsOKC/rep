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

  async function createExercise(name: string, category: string | null) {
    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('exercises')
      .insert({ user_id: userId, name, category })
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

  async function updateExerciseName(id: string, name: string) {
    const { error } = await supabase.from('exercises').update({ name }).eq('id', id)
    if (!error) {
      const exercise = exercises.value.find((e) => e.id === id)
      if (exercise) exercise.name = name
    }
    return { error }
  }

  async function updateSetupNotes(id: string, setupNotes: string | null) {
    const { error } = await supabase.from('exercises').update({ setup_notes: setupNotes }).eq('id', id)
    if (!error) {
      const exercise = exercises.value.find((e) => e.id === id)
      if (exercise) exercise.setup_notes = setupNotes
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
    updateExerciseName,
    updateSetupNotes,
  }
})
