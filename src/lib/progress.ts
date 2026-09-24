// Backlog item 19: Log home screen's "recent PR" stat. Recomputed on load
// from the most recent workout's sets rather than persisted (see
// docs/backlog.md#19 for why) — pure computation, kept separate from the
// store so it's readable/testable on its own, same pattern as volume.ts.
export interface RecentSet {
  exerciseId: string
  exerciseName: string
  reps: number
  weight: number
}

export interface HistoricalSet {
  exerciseId: string
  reps: number
  weight: number
}

// Same "strictly greater than the prior best" rule as checkForRecord in
// stores/workouts.ts (backlog item 4), just replayed against the most
// recent workout's sets instead of reacting to a single insert. Returns the
// name of the first exercise (in set order) that beat its prior all-time
// best, or null if nothing in the workout was a record.
export function findRecentPr(recentSets: RecentSet[], historicalSets: HistoricalSet[]): string | null {
  const bestHistorical = new Map<string, number>()
  for (const s of historicalSets) {
    const volume = s.reps * s.weight
    const best = bestHistorical.get(s.exerciseId) ?? 0
    if (volume > best) bestHistorical.set(s.exerciseId, volume)
  }

  for (const s of recentSets) {
    const volume = s.reps * s.weight
    if (volume > (bestHistorical.get(s.exerciseId) ?? 0)) return s.exerciseName
  }
  return null
}
