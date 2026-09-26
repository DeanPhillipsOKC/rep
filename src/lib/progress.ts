import type { LoadType, WeightUnit } from './types'

// Backlog item 76: a set's "personal record" comparison depends on its
// exercise's load type — a level exercise's weight column is always 0 (not
// linear, so no lb-equivalent scale factor), so the plain reps*weight volume
// rule from before this item would never register a level PR at all. Every
// PR comparison in this file (and checkForRecord in stores/workouts.ts, which
// shares this rule) goes through this one marker/comparator pair instead of
// each keeping its own ad hoc "best number so far".
export interface SetMarker {
  loadType: LoadType
  level: number | null
  reps: number
  weight: number
}

export const ZERO_MARKER: SetMarker = { loadType: 'weight', level: null, reps: 0, weight: 0 }

// A level exercise's sets only ever compare against other sets of the same
// exercise (load type can't change once an exercise has logged sets — see
// docs/backlog.md item 76), so `candidate`/`previousBest` are always the
// same load type in practice; the branch below is keyed on `candidate` alone.
export function beatsBest(candidate: SetMarker, previousBest: SetMarker): boolean {
  if (candidate.loadType === 'level') {
    if (candidate.level === null) return false
    if (previousBest.level === null) return true
    if (candidate.level !== previousBest.level) return candidate.level > previousBest.level
    return candidate.reps > previousBest.reps
  }
  return candidate.reps * candidate.weight > previousBest.reps * previousBest.weight
}

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
  loadType: LoadType
  level: number | null
}

export interface HistoricalSet {
  exerciseId: string
  reps: number
  weight: number
  loadType: LoadType
  level: number | null
}

export interface RecentPr {
  exerciseName: string
  reps: number
  weight: number
  weightUnit: WeightUnit
  loadType: LoadType
  level: number | null
}

// Same "strictly beats the prior best" rule as checkForRecord in
// stores/workouts.ts (backlog item 4), just replayed against the most
// recent workout's sets instead of reacting to a single insert. Returns the
// first set (in set order) that beat its prior all-time best — item 44's
// celebratory PR tile needs the reps/weight themselves, not just the
// exercise name — or null if nothing in the workout was a record.
export function findRecentPr(recentSets: RecentSet[], historicalSets: HistoricalSet[]): RecentPr | null {
  const bestHistorical = new Map<string, SetMarker>()
  for (const s of historicalSets) {
    const marker: SetMarker = { loadType: s.loadType, level: s.level, reps: s.reps, weight: s.weight }
    if (beatsBest(marker, bestHistorical.get(s.exerciseId) ?? ZERO_MARKER)) {
      bestHistorical.set(s.exerciseId, marker)
    }
  }

  for (const s of recentSets) {
    const marker: SetMarker = { loadType: s.loadType, level: s.level, reps: s.reps, weight: s.weight }
    if (beatsBest(marker, bestHistorical.get(s.exerciseId) ?? ZERO_MARKER)) {
      return {
        exerciseName: s.exerciseName,
        reps: s.reps,
        weight: s.weight,
        weightUnit: s.weightUnit,
        loadType: s.loadType,
        level: s.level,
      }
    }
  }
  return null
}

export interface HistoryWorkoutForPr {
  id: string
  performed_at: string
  sets: { exercise_id: string; reps: number; weight: number; level: number | null; exercises?: { load_type: LoadType } | null }[]
}

// Backlog item 45: History's timeline PR marker. Same "strictly beats the
// prior best" rule as checkForRecord/findRecentPr above, replayed
// chronologically across the whole history (oldest first, since a set can
// only be a record relative to what came before it) to mark every workout
// that contained one, not just the most recent.
export function findPrWorkoutIds(workouts: HistoryWorkoutForPr[]): Set<string> {
  const chronological = [...workouts].sort(
    (a, b) => new Date(a.performed_at).getTime() - new Date(b.performed_at).getTime()
  )

  const bestSoFar = new Map<string, SetMarker>()
  const prWorkoutIds = new Set<string>()
  for (const w of chronological) {
    for (const s of w.sets) {
      const marker: SetMarker = {
        loadType: s.exercises?.load_type ?? 'weight',
        level: s.level,
        reps: s.reps,
        weight: s.weight,
      }
      if (beatsBest(marker, bestSoFar.get(s.exercise_id) ?? ZERO_MARKER)) {
        bestSoFar.set(s.exercise_id, marker)
        prWorkoutIds.add(w.id)
      }
    }
  }
  return prWorkoutIds
}
