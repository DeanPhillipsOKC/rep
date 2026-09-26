import type { WeightUnit } from './types'

// Backlog item 1: exercise-by-exercise history detail. Pure grouping/summary
// helpers kept separate from the store, same pattern as progress.ts/volume.ts.

export interface ExerciseHistorySet {
  id: string
  reps: number
  weight: number
  weight_unit: WeightUnit
  rpe: number | null
  level: number | null
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

// Backlog item 76: a level exercise's weight is always 0 (see SetEntry.level),
// so heaviestSetByUnit above is meaningless for one — ExerciseHistoryDetail.vue
// shows this summary instead. Same "higher level, or same level with more
// reps" comparison as progress.ts's beatsBest, applied here since this file
// only ever sees one exercise's own sets at a time (not the per-exercise Map
// that comparison normally keys off).
export function bestLevelSet(workouts: ExerciseHistoryWorkout[]): { level: number; reps: number } | null {
  let best: { level: number; reps: number } | null = null
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.level === null) continue
      if (!best || s.level > best.level || (s.level === best.level && s.reps > best.reps)) {
        best = { level: s.level, reps: s.reps }
      }
    }
  }
  return best
}
