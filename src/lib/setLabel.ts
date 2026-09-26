import type { LoadType, WeightUnit } from './types'

// Backlog item 76: a level exercise's set has no meaningful weight (the
// column is stored as 0 to satisfy the not-null constraint), so every place
// a set gets rendered needs to say "12 × Level 3" instead of "12 × 0lb".
// Bodyweight/assisted load types stay on the plain weight+unit label for now
// (their own effective-load rendering is items 78/79's job).
export function formatSetLabel(
  loadType: LoadType,
  reps: number,
  weight: number,
  weightUnit: WeightUnit,
  level: number | null,
): string {
  if (loadType === 'level' && level !== null) return `${reps} × Level ${level}`
  return `${reps} × ${weight}${weightUnit}`
}
