// Backlog item 6: post-workout volume chart. Pure computation, kept separate
// from the store so the projection rule (docs/backlog.md#6) is testable/
// readable on its own.
import type { WorkoutWithSets } from './types'

export interface VolumeChartPoint {
  performedAt: string
  actual: number
  projected: number
}

export interface TemplateExerciseTarget {
  exercise_id: string
  target_sets: number | null
}

// `workouts` must be ascending by performed_at (oldest first) so carry-
// forward reads only ever look backward in time.
//
// Decision (docs/backlog.md#6, don't recompute): no weighted-percentage
// credit for a partial exercise. An exercise that was skipped or fell short
// of its template's target_sets has its entire contribution to that point's
// projected total replaced by its own last known actual volume — straight
// carry-forward, not a blend.
export function computeVolumeHistory(
  workouts: WorkoutWithSets[],
  templateExercises: TemplateExerciseTarget[]
): VolumeChartPoint[] {
  const lastKnownVolume = new Map<string, number>()

  return workouts.map((w) => {
    const actual = w.sets.reduce((sum, s) => sum + s.reps * s.weight, 0)

    // Start from the same literal total as `actual`, then swap in the
    // carried-forward volume only for exercises that were skipped or fell
    // short of target_sets, leaving every completed (or non-template)
    // exercise's actual contribution untouched.
    let projected = actual
    for (const te of templateExercises) {
      const setsForExercise = w.sets.filter((s) => s.exercise_id === te.exercise_id)
      const exerciseVolume = setsForExercise.reduce((sum, s) => sum + s.reps * s.weight, 0)

      const complete =
        te.target_sets != null ? setsForExercise.length >= te.target_sets : setsForExercise.length > 0

      if (!complete) {
        const carried = lastKnownVolume.get(te.exercise_id) ?? exerciseVolume
        projected += carried - exerciseVolume
      }

      if (setsForExercise.length > 0) {
        lastKnownVolume.set(te.exercise_id, exerciseVolume)
      }
    }

    return { performedAt: w.performed_at, actual, projected }
  })
}
