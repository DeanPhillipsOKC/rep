import type { WeightUnit } from './types'

// Backlog item 19: Log home screen's "recent PR" stat. Recomputed on load
// from the most recent workout's sets rather than persisted (see
// docs/backlog.md#19 for why) — pure computation, kept separate from the
// store so it's readable/testable on its own, same pattern as volume.ts.
export interface RecentSet {
  exerciseId: string
  exerciseName: string
  reps: number
  weight: number
  weightUnit: WeightUnit
}

export interface HistoricalSet {
  exerciseId: string
  reps: number
  weight: number
}

export interface RecentPr {
  exerciseName: string
  reps: number
  weight: number
  weightUnit: WeightUnit
}

// Same "strictly greater than the prior best" rule as checkForRecord in
// stores/workouts.ts (backlog item 4), just replayed against the most
// recent workout's sets instead of reacting to a single insert. Returns the
// first set (in set order) that beat its prior all-time best — item 44's
// celebratory PR tile needs the reps/weight themselves, not just the
// exercise name — or null if nothing in the workout was a record.
export function findRecentPr(recentSets: RecentSet[], historicalSets: HistoricalSet[]): RecentPr | null {
  const bestHistorical = new Map<string, number>()
  for (const s of historicalSets) {
    const volume = s.reps * s.weight
    const best = bestHistorical.get(s.exerciseId) ?? 0
    if (volume > best) bestHistorical.set(s.exerciseId, volume)
  }

  for (const s of recentSets) {
    const volume = s.reps * s.weight
    if (volume > (bestHistorical.get(s.exerciseId) ?? 0)) {
      return { exerciseName: s.exerciseName, reps: s.reps, weight: s.weight, weightUnit: s.weightUnit }
    }
  }
  return null
}

export interface HistoryWorkoutForPr {
  id: string
  performed_at: string
  sets: { exercise_id: string; reps: number; weight: number }[]
}

// Backlog item 45: History's timeline PR marker. Same "strictly greater than
// the prior best" rule as checkForRecord/findRecentPr above, replayed
// chronologically across the whole history (oldest first, since a set can
// only be a record relative to what came before it) to mark every workout
// that contained one, not just the most recent.
export function findPrWorkoutIds(workouts: HistoryWorkoutForPr[]): Set<string> {
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
  )

  const bestSoFar = new Map<string, number>()
  const prWorkoutIds = new Set<string>()
  for (const w of chronological) {
    for (const s of w.sets) {
      const volume = s.reps * s.weight
      const best = bestSoFar.get(s.exercise_id) ?? 0
      if (volume > best) {
        bestSoFar.set(s.exercise_id, volume)
        prWorkoutIds.add(w.id)
      }
    }
  }
  return prWorkoutIds
}
