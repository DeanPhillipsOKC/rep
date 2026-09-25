import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { findRecentPr, type RecentPr } from '../lib/progress'
import { computeVolumeHistory, type TemplateExerciseTarget, type VolumeChartPoint } from '../lib/volume'
import type { SetEntry, WeightUnit, WorkoutWithSets } from '../lib/types'

// Core logging flow per docs/architecture.md build order step 4:
// create workout -> add sets to it -> view history.
export const useWorkoutsStore = defineStore('workouts', () => {
  const history = ref<WorkoutWithSets[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const activeWorkoutId = ref<string | null>(null)
  const activeTemplateId = ref<string | null>(null)
  const activeSets = ref<SetEntry[]>([])
  const previousWorkout = ref<WorkoutWithSets | null>(null)

  // Backlog item 6: post-workout volume-over-time chart for the template
  // just finished. Populated by fetchTemplateVolumeHistory, cleared by
  // clearVolumeHistory once the chart has been dismissed.
  const volumeHistory = ref<VolumeChartPoint[]>([])
  const volumeHistoryError = ref('')

  // Backlog item 11: addSet's insert can still be in flight when the user
  // (or a fast test script) moves straight on to finishing/starting a
  // workout. Anything that reads or depends on "this workout's sets are
  // fully committed" — fetchPreviousWorkout's query, finishWorkout's
  // empty-workout delete — awaits this first so it can't run ahead of a
  // write it was racing.
  const pendingWrites = new Set<PromiseLike<unknown>>()

  async function waitForPendingWrites() {
    if (pendingWrites.size > 0) await Promise.all(pendingWrites)
  }

  // Backlog item 4 (screen: item 38): set by the (unawaited) record check
  // kicked off from addSet below. A plain ref rather than addSet's return
  // value so the record check can run in the background without slowing
  // down the add — the UI reacts to this changing instead of waiting on it.
  // Carries the full set (not just volume) so the celebration screen can
  // show what was actually lifted and how it compares to the prior best.
  const newRecord = ref<{
    exerciseId: string
    reps: number
    weight: number
    weightUnit: WeightUnit
    previousBest: number
  } | null>(null)

  // Backlog item 3: most recent past workout logged against this template
  // that actually has sets on it, so the logger can show what to beat.
  // `sets!inner` turns the embed into an inner join so workouts with zero
  // sets (e.g. started and finished without logging anything) are excluded
  // rather than winning on recency and showing an empty card. Called before
  // startWorkout so the just-created row can't show up as its own "previous"
  // workout.
  async function fetchPreviousWorkout(templateId: string) {
    await waitForPendingWrites()

    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets!inner(*, exercises(name)), workout_templates(name)')
      .eq('template_id', templateId)
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })
      .limit(1)

    if (!error) {
      previousWorkout.value = (data?.[0] ?? null) as unknown as WorkoutWithSets | null
    }
    return { error }
  }

  // Backlog item 6: full history of a template's past workouts (oldest
  // first, so computeVolumeHistory's carry-forward only ever looks
  // backward), turned into actual/projected volume points. Callers pass the
  // template's current exercise list (position/target_sets) since that's
  // already fetched by the time a workout against it finishes.
  async function fetchTemplateVolumeHistory(templateId: string, templateExercises: TemplateExerciseTarget[]) {
    volumeHistoryError.value = ''
    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name)), workout_templates(name)')
      .eq('template_id', templateId)
      .order('performed_at', { ascending: true })
      .order('set_index', { foreignTable: 'sets', ascending: true })

    if (error) {
      volumeHistoryError.value = error.message
      return { error }
    }
    volumeHistory.value = computeVolumeHistory((data ?? []) as unknown as WorkoutWithSets[], templateExercises)
    return { error: null }
  }

  function clearVolumeHistory() {
    volumeHistory.value = []
    volumeHistoryError.value = ''
  }

  // Backlog item 19: Log home screen's progress strip. Recomputed on every
  // load rather than persisted — cheap, no migration, but only ever shows
  // "since your last workout" (see docs/backlog.md#19 for the tradeoff).
  const workoutsThisWeek = ref(0)
  const recentPr = ref<RecentPr | null>(null)

  // Backlog item 44: paw-print week tracker on the Home screen replaces the
  // bare count with one dot per day Mon..Sun, filled for a day that has at
  // least one workout. Index 0 = Monday, matching startOfWeek's Monday-based
  // week below (getDay() is Sunday-based, hence the +6 % 7 offset).
  const workoutDaysThisWeek = ref<boolean[]>([false, false, false, false, false, false, false])

  async function fetchProgressStats() {
    const startOfWeek = new Date()
    startOfWeek.setHours(0, 0, 0, 0)
    startOfWeek.setDate(startOfWeek.getDate() - ((startOfWeek.getDay() + 6) % 7))

    const [{ data: weekWorkouts, count: weekCount }, { data: recent }] = await Promise.all([
      // count: 'exact' asks PostgREST for the true total via a header, not
      // just the length of the returned page — the page itself is still
      // capped at PostgREST's default max-rows (1000), which silently froze
      // this tile once the (test) account crossed that many workouts in a
      // week (docs/backlog-archive.md item 56).
      supabase
        .from('workouts')
        .select('performed_at', { count: 'exact' })
        .gte('performed_at', startOfWeek.toISOString()),
      supabase
        .from('workouts')
        .select('id, sets(exercise_id, reps, weight, weight_unit, exercises(name))')
        .order('performed_at', { ascending: false })
        .limit(1),
    ])
    workoutsThisWeek.value = weekCount ?? 0

    const days = [false, false, false, false, false, false, false]
    for (const w of weekWorkouts ?? []) {
      const dayIndex = (new Date(w.performed_at).getDay() + 6) % 7
      days[dayIndex] = true
    }
    workoutDaysThisWeek.value = days

    const recentWorkout = recent?.[0] as unknown as (WorkoutWithSets & { id: string }) | undefined
    if (!recentWorkout || recentWorkout.sets.length === 0) {
      recentPr.value = null
      return
    }

    const exerciseIds = [...new Set(recentWorkout.sets.map((s) => s.exercise_id))]
    const { data: historicalSets } = await supabase
      .from('sets')
      .select('exercise_id, reps, weight')
      .in('exercise_id', exerciseIds)
      .neq('workout_id', recentWorkout.id)

    recentPr.value = findRecentPr(
      recentWorkout.sets.map((s) => ({
        exerciseId: s.exercise_id,
        exerciseName: s.exercises?.name ?? 'Unknown',
        reps: s.reps,
        weight: s.weight,
        weightUnit: s.weight_unit,
      })),
      (historicalSets ?? []).map((s) => ({ exerciseId: s.exercise_id, reps: s.reps, weight: s.weight }))
    )
  }

  async function startWorkout(notes: string | null = null, templateId: string | null = null) {
    await waitForPendingWrites()

    const { data: userData } = await supabase.auth.getUser()
    const userId = userData.user?.id
    if (!userId) return { error: new Error('Not signed in') }

    const { data, error } = await supabase
      .from('workouts')
      .insert({ user_id: userId, notes, template_id: templateId })
      .select()
      .single()

    if (!error && data) {
      activeWorkoutId.value = data.id
      activeTemplateId.value = templateId
      activeSets.value = []
    }
    return { data, error }
  }

  // Backlog item 4: per-user, per-exercise all-time max of reps * weight,
  // across every past set for that exercise regardless of workout/template.
  // Session-local cache: once an exercise's history has been read, later
  // sets for it are compared in memory and only update the cache, never
  // re-reading the DB. This keeps addSet's own critical path (below) free
  // of any lookup — the record check runs after the insert, in the
  // background, so it never delays the add itself.
  const bestVolumeCache = new Map<string, number>()

  // excludeSetId matters only on a cache miss — this runs after the insert
  // (see checkForRecord), so a first-ever read of this exercise's history
  // would otherwise see the just-inserted row and compare it against itself.
  async function getBestVolume(exerciseId: string, excludeSetId: string): Promise<number> {
    const cached = bestVolumeCache.get(exerciseId)
    if (cached !== undefined) return cached

    const { data, error } = await supabase
      .from('sets')
      .select('reps, weight')
      .eq('exercise_id', exerciseId)
      .neq('id', excludeSetId)
    const best = !error && data ? data.reduce((max, s) => Math.max(max, s.reps * s.weight), 0) : 0
    bestVolumeCache.set(exerciseId, best)
    return best
  }

  async function checkForRecord(
    exerciseId: string,
    setId: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit
  ) {
    const previousBest = await getBestVolume(exerciseId, setId)
    if (reps * weight > previousBest) {
      bestVolumeCache.set(exerciseId, reps * weight)
      newRecord.value = { exerciseId, reps, weight, weightUnit, previousBest }
    }
  }

  async function addSet(
    exerciseId: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit,
    rpe: number | null
  ) {
    // Captured before the await below — finishWorkout() can clear
    // activeWorkoutId.value/activeSets.value while this call is in flight,
    // and the insert must still target the workout it started with.
    const workoutId = activeWorkoutId.value
    if (!workoutId) return { error: new Error('No active workout') }

    // set_index below is a placeholder only, to satisfy the not-null
    // column — two addSet calls fired close together can both read the
    // same activeSets.value.length before either insert lands, so this
    // value can't be trusted. The `sets_set_index` DB trigger (backlog
    // item 10, supabase/schema.sql) overwrites it server-side with the
    // real position, which is what comes back in `data` below.
    const insert = supabase
      .from('sets')
      .insert({
        workout_id: workoutId,
        exercise_id: exerciseId,
        set_index: activeSets.value.length,
        reps,
        weight,
        weight_unit: weightUnit,
        rpe,
      })
      .select()
      .single()

    pendingWrites.add(insert)
    const { data, error } = await insert
    pendingWrites.delete(insert)

    if (!error && data) {
      if (activeWorkoutId.value === workoutId) activeSets.value.push(data)
      checkForRecord(exerciseId, data.id, reps, weight, weightUnit)
    }
    return { data, error }
  }

  // Backlog item 9: a workout finished (or abandoned) with zero sets logged
  // shouldn't survive — it shadows real workouts in the "last time" lookup
  // (see fetchPreviousWorkout) and would skew any future reporting that
  // scans `workouts` directly. Delete it instead of leaving an empty row.
  // Backlog item 13: fix a fat-fingered reps/weight/rpe entry on a set still
  // in the active, not-yet-finished workout. Only touches activeSets — the
  // History view's past workouts have no edit affordance and shouldn't.
  async function updateSet(
    id: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit,
    rpe: number | null
  ) {
    const { error } = await supabase
      .from('sets')
      .update({ reps, weight, weight_unit: weightUnit, rpe })
      .eq('id', id)
    if (!error) {
      const set = activeSets.value.find((s) => s.id === id)
      if (set) {
        set.reps = reps
        set.weight = weight
        set.weight_unit = weightUnit
        set.rpe = rpe
      }
    }
    return { error }
  }

  // Backlog item 13: remove a set logged in error from the active workout.
  // Deliberately doesn't renumber set_index on the remaining rows — see
  // docs/backlog-archive.md item 9's pre-fill note on why gaps are harmless.
  async function deleteSet(id: string) {
    const { error } = await supabase.from('sets').delete().eq('id', id)
    if (!error) {
      activeSets.value = activeSets.value.filter((s) => s.id !== id)
    }
    return { error }
  }

  async function finishWorkout() {
    await waitForPendingWrites()

    if (activeWorkoutId.value && activeSets.value.length === 0) {
      await supabase.from('workouts').delete().eq('id', activeWorkoutId.value)
    }
    activeWorkoutId.value = null
    activeTemplateId.value = null
    activeSets.value = []
    previousWorkout.value = null
    newRecord.value = null
  }

  // Backlog item 31: remove a finished workout logged in error (duplicate,
  // wrong day, test data). `sets.workout_id` has `on delete cascade`
  // (supabase/schema.sql), so deleting the workout row alone is enough.
  async function deleteWorkout(id: string) {
    const { error } = await supabase.from('workouts').delete().eq('id', id)
    if (!error) {
      history.value = history.value.filter((w) => w.id !== id)
    }
    return { error }
  }

  // Backlog item 32: fix a fat-fingered reps/weight/rpe entry, or remove a
  // set entirely, on an already-finished workout from History — same DB
  // write as updateSet/deleteSet above, but reading/writing `history`
  // instead of `activeSets` since a finished workout's sets live there.
  async function updateHistorySet(
    id: string,
    reps: number,
    weight: number,
    weightUnit: WeightUnit,
    rpe: number | null
  ) {
    const { error } = await supabase
      .from('sets')
      .update({ reps, weight, weight_unit: weightUnit, rpe })
      .eq('id', id)
    if (!error) {
      for (const entry of history.value) {
        const set = entry.sets.find((s) => s.id === id)
        if (set) {
          set.reps = reps
          set.weight = weight
          set.weight_unit = weightUnit
          set.rpe = rpe
          break
        }
      }
    }
    return { error }
  }

  async function deleteHistorySet(id: string) {
    const { error } = await supabase.from('sets').delete().eq('id', id)
    if (!error) {
      for (const entry of history.value) {
        const index = entry.sets.findIndex((s) => s.id === id)
        if (index !== -1) {
          entry.sets.splice(index, 1)
          break
        }
      }
    }
    return { error }
  }

  // Backlog item 32: fix a missing or wrong note on a finished workout.
  async function updateWorkoutNotes(id: string, notes: string | null) {
    const { error } = await supabase.from('workouts').update({ notes }).eq('id', id)
    if (!error) {
      const entry = history.value.find((w) => w.id === id)
      if (entry) entry.notes = notes
    }
    return { error }
  }

  async function fetchHistory() {
    loading.value = true
    errorMessage.value = ''
    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name)), workout_templates(name)')
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })

    if (error) {
      errorMessage.value = error.message
    } else {
      history.value = (data ?? []) as unknown as WorkoutWithSets[]
    }
    loading.value = false
  }

  return {
    history,
    loading,
    errorMessage,
    activeWorkoutId,
    activeTemplateId,
    activeSets,
    previousWorkout,
    volumeHistory,
    volumeHistoryError,
    newRecord,
    workoutsThisWeek,
    workoutDaysThisWeek,
    recentPr,
    startWorkout,
    addSet,
    updateSet,
    deleteSet,
    updateHistorySet,
    deleteHistorySet,
    updateWorkoutNotes,
    finishWorkout,
    fetchHistory,
    deleteWorkout,
    fetchPreviousWorkout,
    fetchTemplateVolumeHistory,
    clearVolumeHistory,
    fetchProgressStats,
  }
})
