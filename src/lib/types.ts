// Mirrors supabase/schema.sql. See docs/architecture.md#data-model.

export interface Exercise {
  id: string
  user_id: string
  name: string
  category: string | null
  is_archived: boolean
}

export interface Workout {
  id: string
  user_id: string
  performed_at: string
  notes: string | null
}

export type WeightUnit = 'lb' | 'kg'

export interface SetEntry {
  id: string
  workout_id: string
  exercise_id: string
  set_index: number
  reps: number
  weight: number
  weight_unit: WeightUnit
  rpe: number | null
}

// Shape returned by the nested select in workouts.ts (workout + its sets +
// each set's exercise name), used for the history view.
export interface SetWithExercise extends SetEntry {
  exercises: { name: string } | null
}

export interface WorkoutWithSets extends Workout {
  sets: SetWithExercise[]
}
