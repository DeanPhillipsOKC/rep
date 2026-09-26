// Backlog item 6: post-workout volume chart. Pure computation, kept separate
// from the store so the projection rule (docs/backlog.md#6) is testable/
// readable on its own.
import type { LoadType, WeightUnit, WorkoutWithSets } from './types'

export interface VolumeChartPoint {
  performedAt: string
  actual: number
  projected: number
  weightUnit: WeightUnit
}

// A workout's sets should all share one unit in practice, but nothing
// enforces that — take whichever unit appears most often so a stray mixed
// entry can't flip the whole point's label. Defaults to 'lb' for a
// zero-set workout (item 9 usually deletes those before they'd ever reach
// here, but computeVolumeHistory shouldn't assume that).
function modeWeightUnit(sets: { weight_unit: WeightUnit }[]): WeightUnit {
  if (sets.length === 0) return 'lb'
  const counts = new Map<WeightUnit, number>()
  for (const s of sets) counts.set(s.weight_unit, (counts.get(s.weight_unit) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
}

export interface TemplateExerciseTarget {
  exercise_id: string
  target_sets: number | null
  exercises?: { load_type: LoadType } | null
}

// Backlog item 76: level exercises are excluded from volume entirely
// (difficulty levels aren't linear, so there's no "each level ≈ X lb" scale
// factor) — not counted as 0, which would make a level-only set look like a
// volume collapse.
function isVolumeEligible(s: { exercises?: { load_type: LoadType } | null }): boolean {
  return s.exercises?.load_type !== 'level'
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
    const actual = w.sets.filter(isVolumeEligible).reduce((sum, s) => sum + s.reps * s.weight, 0)

    // Start from the same literal total as `actual`, then swap in the
    // carried-forward volume only for exercises that were skipped or fell
    // short of target_sets, leaving every completed (or non-template)
    // exercise's actual contribution untouched.
    let projected = actual
    for (const te of templateExercises) {
      // A level-typed template exercise always contributes 0 either way, but
      // skip it outright rather than let it flow through the "skipped/short"
      // branch below — it was never really skipped, levels just don't count.
      if (te.exercises?.load_type === 'level') continue

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

    return { performedAt: w.performed_at, actual, projected, weightUnit: modeWeightUnit(w.sets) }
  })
}
