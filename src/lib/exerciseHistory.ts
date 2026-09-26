import type { WeightUnit } from './types'

// Backlog item 1: exercise-by-exercise history detail. Pure grouping/summary
// helpers kept separate from the store, same pattern as progress.ts/volume.ts.

export interface ExerciseHistorySet {
  id: string
  reps: number
  weight: number
  weight_unit: WeightUnit
  rpe: number | null
}

export interface ExerciseHistoryWorkout {
  workoutId: string
  performedAt: string
  sets: ExerciseHistorySet[]
}

// Heaviest completed set kept separate per weight unit rather than converted
// -- lb and kg aren't otherwise converted anywhere in this app, so combining
// them into one number would silently misrepresent whichever unit lost the
// comparison. Only units actually present in the history show up in the
// result.
export function heaviestSetByUnit(workouts: ExerciseHistoryWorkout[]): Partial<Record<WeightUnit, number>> {
  const heaviest: Partial<Record<WeightUnit, number>> = {}
  for (const w of workouts) {
    for (const s of w.sets) {
      const current = heaviest[s.weight_unit]
      if (current === undefined || s.weight > current) {
        heaviest[s.weight_unit] = s.weight
      }
    }
  }
  return heaviest
}
