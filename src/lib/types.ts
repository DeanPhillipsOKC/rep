// Mirrors supabase/schema.sql. See docs/architecture.md#data-model.

export interface Exercise {
  id: string
  user_id: string
  name: string
  category: string | null
  is_archived: boolean
  setup_notes: string | null
  rest_seconds: number | null
}

export interface WorkoutTemplate {
  id: string
  user_id: string
  name: string
  is_archived: boolean
}

export interface WorkoutTemplateExercise {
  id: string
  template_id: string
  exercise_id: string
  position: number
  target_sets: number | null
}

// Shape returned by the nested select in templates.ts (template exercise +
// its exercise name), used to render a template's exercise list.
export interface TemplateExerciseWithName extends WorkoutTemplateExercise {
  exercises: { name: string; is_archived: boolean } | null
}

export interface Workout {
  id: string
  user_id: string
  template_id: string | null
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
  workout_templates: { name: string } | null
}
