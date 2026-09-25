import { supabase } from './supabase'
import type { Exercise, SetEntry, Workout, WorkoutTemplate, WorkoutTemplateExercise } from './types'

const PAGE_SIZE = 500
type ExportTable = 'exercises' | 'workout_templates' | 'workout_template_exercises' | 'workouts' | 'sets'

// A fixed order by primary key keeps page boundaries stable. A short final
// page (including an empty page after an exact multiple) signals completion.
async function fetchAll(table: ExportTable, userId?: string): Promise<Record<string, unknown>[]> {
  const rows: Record<string, unknown>[] = []
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase.from(table).select('*').order('id').range(offset, offset + PAGE_SIZE - 1)
    if (userId) query = query.eq('user_id', userId)
    const { data, error } = await query
    if (error) throw new Error(`Could not export ${table}: ${error.message}`)
    rows.push(...(data ?? []))
    if ((data ?? []).length < PAGE_SIZE) return rows
  }
}

export interface TrainingDataExport {
  version: 1
  exported_at: string
  exercises: Exercise[]
  workout_templates: WorkoutTemplate[]
  workout_template_exercises: WorkoutTemplateExercise[]
  workouts: Workout[]
  sets: SetEntry[]
}

export async function fetchTrainingData(): Promise<TrainingDataExport> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Sign in again before exporting your data.')

  const exercises = await fetchAll('exercises', user.id) as unknown as Exercise[]
  const templates = await fetchAll('workout_templates', user.id) as unknown as WorkoutTemplate[]
  const templateExercises = await fetchAll('workout_template_exercises') as unknown as WorkoutTemplateExercise[]
  const workouts = await fetchAll('workouts', user.id) as unknown as Workout[]
  const sets = await fetchAll('sets') as unknown as SetEntry[]

  // These tables inherit ownership through their parent under RLS. Fail
  // closed if a broken policy ever returns an unrelated child row.
  const templateIds = new Set(templates.map((row) => row.id))
  const workoutIds = new Set(workouts.map((row) => row.id))
  if (templateExercises.some((row) => !templateIds.has(row.template_id)) ||
      sets.some((row) => !workoutIds.has(row.workout_id))) {
    throw new Error('Could not verify ownership of all training data. No file was downloaded.')
  }

  return {
    version: 1,
    exported_at: new Date().toISOString(),
    exercises,
    workout_templates: templates,
    workout_template_exercises: templateExercises,
    workouts,
    sets,
  }
}
