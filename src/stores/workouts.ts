import { ref } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '../lib/supabase'
import { findRecentPr, type RecentPr } from '../lib/progress'
import { computeVolumeHistory, type TemplateExerciseTarget, type VolumeChartPoint } from '../lib/volume'
import type { ExerciseHistoryWorkout } from '../lib/exerciseHistory'
import type { SetEntry, WeightUnit, WorkoutWithSets } from '../lib/types'

// Recover-interrupted-workout item: the only local trace of "which workout
// row is the active one," so a reload/relaunch can look it back up through
// the normal signed-in Supabase client instead of losing the session. Holds
// just the id — never trusted on its own, always re-fetched and RLS-checked
// before anything is restored from it (see checkForRecoverableWorkout).
const ACTIVE_WORKOUT_STORAGE_KEY = 'repbunny-active-workout-id'

function persistActiveWorkoutId(id: string | null) {
  if (id) localStorage.setItem(ACTIVE_WORKOUT_STORAGE_KEY, id)
  else localStorage.removeItem(ACTIVE_WORKOUT_STORAGE_KEY)
}

// Core logging flow per docs/architecture.md build order step 4:
// create workout -> add sets to it -> view history.
export const useWorkoutsStore = defineStore('workouts', () => {
  const history = ref<WorkoutWithSets[]>([])
  const loading = ref(false)
  const errorMessage = ref('')

  const activeWorkoutId = ref<string | null>(null)
  const activeTemplateId = ref<string | null>(null)
  // Backlog item 50: client-side-only start time for the in-session elapsed
  // timer. Not persisted — a refresh loses it, same as activeWorkoutId
  // itself, until the `finished_at`/session-persistence migration this
  // item explicitly scopes out lands (see docs/backlog.md item 50).
  const activeWorkoutStartedAt = ref<number | null>(null)
  const activeSets = ref<SetEntry[]>([])
  const previousWorkout = ref<WorkoutWithSets | null>(null)

  // Recover-interrupted-workout item: populated by checkForRecoverableWorkout
  // when a persisted active-workout reference resolves to a real, still-owned
  // row on boot. Kept separate from activeWorkoutId so the logger can offer
  // an explicit Resume/Discard choice instead of silently dropping the user
  // back into an in-progress session.
  const recoverableWorkout = ref<WorkoutWithSets | null>(null)

  // Resume-after-finish item: the workout finishWorkout() most recently
  // completed with at least one set, offered back as an undo for an
  // accidental "Finish workout" tap. Deliberately NOT persisted like
  // ACTIVE_WORKOUT_STORAGE_KEY above — this is a short-lived, same-session
  // undo window, not crash recovery, so a reload silently drops the offer
  // rather than resurrecting it indefinitely. justFinishedWorkoutId is set
  // synchronously by finishWorkout; justFinishedWorkout is the fresh,
  // server-fetched copy (same shape/query as checkForRecoverableWorkout)
  // that fetchJustFinishedWorkout populates before the UI offers to resume,
  // so resumeJustFinishedWorkout restores from real server state rather than
  // a possibly-stale in-memory snapshot.
  const justFinishedWorkoutId = ref<string | null>(null)
  const justFinishedWorkout = ref<WorkoutWithSets | null>(null)

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
  // excludeWorkoutId matters for resumeRecoverableWorkout below: the workout
  // being resumed already exists in `workouts` by the time this runs, so
  // without excluding it the "most recent workout for this template" query
  // would just find itself and show the resumed session as its own "last
  // time" card.
  async function fetchPreviousWorkout(templateId: string, excludeWorkoutId: string | null = null) {
    await waitForPendingWrites()

    let query = supabase
      .from('workouts')
      .select('*, sets!inner(*, exercises(name)), workout_templates(name)')
      .eq('template_id', templateId)
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })
      .limit(1)
    if (excludeWorkoutId) query = query.neq('id', excludeWorkoutId)

    const { data, error } = await query

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
      activeWorkoutStartedAt.value = Date.now()
      activeSets.value = []
      persistActiveWorkoutId(data.id)
      // Resume-after-finish item: the window only ever covers the single
      // most-recently-finished workout, so starting any new one closes it.
      justFinishedWorkoutId.value = null
      justFinishedWorkout.value = null
    }
    return { data, error }
  }

  // Recover-interrupted-workout item: reads the persisted active-workout
  // reference (if any) and re-fetches it through the normal signed-in
  // client — RLS is what actually enforces "or belongs to another account"
  // from the item's requirements, so a row that isn't (or is no longer)
  // this user's just comes back empty, same as one that was deleted.
  // Guarded on activeWorkoutId so it's a no-op once a workout is already
  // active in this session (e.g. re-running after sign-in with one already
  // started).
  async function checkForRecoverableWorkout() {
    const id = localStorage.getItem(ACTIVE_WORKOUT_STORAGE_KEY)
    if (!id || activeWorkoutId.value) return

    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name)), workout_templates(name)')
      .eq('id', id)
      .order('set_index', { foreignTable: 'sets', ascending: true })
      .maybeSingle()

    if (error || !data) {
      persistActiveWorkoutId(null)
      return
    }
    recoverableWorkout.value = data as unknown as WorkoutWithSets
  }

  // Restores the template, start time, and server-ordered sets exactly as
  // fetched by checkForRecoverableWorkout — never trusts any other cached
  // set list. Doesn't touch `notes`/template-exercise state; the caller
  // (WorkoutLogger.vue) reads recoverableWorkout for those before calling
  // this, same as it already does for a freshly started workout.
  function resumeRecoverableWorkout() {
    const recovered = recoverableWorkout.value
    if (!recovered) return
    activeWorkoutId.value = recovered.id
    activeTemplateId.value = recovered.template_id
    activeWorkoutStartedAt.value = new Date(recovered.performed_at).getTime()
    activeSets.value = recovered.sets
    recoverableWorkout.value = null
    persistActiveWorkoutId(recovered.id)
  }

  // Only ever called after the user explicitly confirms discarding a
  // recovered workout (WorkoutLogger.vue) — including one with saved sets,
  // per the item's "never silently deleted" requirement. `sets.workout_id`
  // cascades (supabase/schema.sql), same as deleteWorkout below.
  async function discardRecoverableWorkout() {
    const recovered = recoverableWorkout.value
    if (!recovered) return { error: null }
    const { error } = await supabase.from('workouts').delete().eq('id', recovered.id)
    if (!error) {
      recoverableWorkout.value = null
      persistActiveWorkoutId(null)
    }
    return { error }
  }

  // Sign-out (AuthGate.vue): this device may next be signed into the other
  // pilot account, so both the in-memory active-workout state and the
  // persisted reference need to be gone — otherwise the next sign-in could
  // offer to "resume" a workout that belongs to a different account entirely
  // (checkForRecoverableWorkout's RLS-backed fetch would just fail for it,
  // but there's no reason to even try).
  function resetActiveWorkoutState() {
    activeWorkoutId.value = null
    activeTemplateId.value = null
    activeWorkoutStartedAt.value = null
    activeSets.value = []
    previousWorkout.value = null
    newRecord.value = null
    recoverableWorkout.value = null
    justFinishedWorkoutId.value = null
    justFinishedWorkout.value = null
    persistActiveWorkoutId(null)
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
    rpe: number | null,
    setId: string = crypto.randomUUID(),
    retry = false
  ) {
    // Captured before the await below — finishWorkout() can clear
    // activeWorkoutId.value/activeSets.value while this call is in flight,
    // and the insert must still target the workout it started with.
    const workoutId = activeWorkoutId.value
    if (!workoutId) return { error: new Error('No active workout') }

    // A failed response does not prove the insert failed. On retry, read by
    // the same client ID before writing again. If the read itself fails, keep
    // the row uncertain rather than risking a second set.
    async function findSavedSet() {
      try {
        const { data, error } = await supabase.from('sets').select('*')
          .eq('id', setId).eq('workout_id', workoutId).maybeSingle()
        return { data: data as SetEntry | null, error }
      } catch (cause) {
        return { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }
      }
    }

    function acceptSavedSet(data: SetEntry) {
      if (activeWorkoutId.value === workoutId && !activeSets.value.some((set) => set.id === data.id)) {
        activeSets.value.push(data)
      }
      checkForRecord(data.exercise_id, data.id, data.reps, data.weight, data.weight_unit)
    }

    if (retry) {
      const found = await findSavedSet()
      if (found.error) return { data: null, error: found.error, reconciled: false }
      if (found.data) {
        acceptSavedSet(found.data)
        return { data: found.data, error: null, reconciled: true }
      }
    }

    // set_index below is a placeholder only, to satisfy the not-null
    // column — two addSet calls fired close together can both read the
    // same activeSets.value.length before either insert lands, so this
    // value can't be trusted. The `sets_set_index` DB trigger (backlog
    // item 10, supabase/schema.sql) overwrites it server-side with the
    // real position, which is what comes back in `data` below.
    const insert = supabase
      .from('sets')
      .insert({
        id: setId,
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

    // Resolve the PostgREST thenable once; awaiting it twice would send a
    // second POST if finishWorkout also waits for this in-flight write.
    const write = Promise.resolve(insert)
    pendingWrites.add(write)
    let result: { data: SetEntry | null; error: Error | null }
    try {
      result = await write
    } catch (cause) {
      result = { data: null, error: cause instanceof Error ? cause : new Error(String(cause)) }
    } finally {
      pendingWrites.delete(write)
    }
    const { data, error } = result

    if (!error && data) {
      acceptSavedSet(data)
    }
    if (error && retry && 'code' in error && error.code === '23505') {
      // The first insert may have landed between the lookup and this insert.
      // Only the matching persisted row is proof of success.
      const found = await findSavedSet()
      if (found.error) return { data: null, error: found.error, reconciled: false }
      if (found.data) {
        acceptSavedSet(found.data)
        return { data: found.data, error: null, reconciled: true }
      }
    }
    return { data, error, reconciled: false }
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

    const finishedWorkoutId = activeWorkoutId.value
    const hadSets = activeSets.value.length > 0

    if (activeWorkoutId.value && activeSets.value.length === 0) {
      await supabase.from('workouts').delete().eq('id', activeWorkoutId.value)
    }
    activeWorkoutId.value = null
    activeTemplateId.value = null
    activeWorkoutStartedAt.value = null
    activeSets.value = []
    previousWorkout.value = null
    newRecord.value = null
    persistActiveWorkoutId(null)

    // Only a workout that actually has sets is worth offering to resume — an
    // empty one was just deleted above, same as always.
    justFinishedWorkoutId.value = hadSets ? finishedWorkoutId : null
    justFinishedWorkout.value = null
  }

  // Resume-after-finish item: re-fetches the just-finished workout through
  // the normal signed-in client, same query shape as
  // checkForRecoverableWorkout, so the offer is backed by real server state
  // (not a stale in-memory copy) by the time resumeJustFinishedWorkout runs.
  async function fetchJustFinishedWorkout() {
    const id = justFinishedWorkoutId.value
    if (!id) return

    const { data, error } = await supabase
      .from('workouts')
      .select('*, sets(*, exercises(name)), workout_templates(name)')
      .eq('id', id)
      .order('set_index', { foreignTable: 'sets', ascending: true })
      .maybeSingle()

    // Stale-response guard: this fetch is fired without the caller waiting
    // on it (handleFinish in WorkoutLogger.vue isn't itself awaited from its
    // click handler), so a fast-enough next action — starting a new workout
    // (which clears these two refs itself) or dismissing the offer — can
    // land before this resolves. Applying a response after that would
    // resurrect a stale "Resume your workout?" card over an unrelated
    // session that's already moved on.
    if (justFinishedWorkoutId.value !== id) return

    if (error || !data) {
      justFinishedWorkoutId.value = null
      return
    }
    justFinishedWorkout.value = data as unknown as WorkoutWithSets
  }

  // Re-attaches activeWorkoutId to the just-finished workout and restores
  // activeTemplateId/activeSets from the server, same restore shape as
  // resumeRecoverableWorkout below.
  function resumeJustFinishedWorkout() {
    const justFinished = justFinishedWorkout.value
    if (!justFinished) return
    activeWorkoutId.value = justFinished.id
    activeTemplateId.value = justFinished.template_id
    activeWorkoutStartedAt.value = new Date(justFinished.performed_at).getTime()
    activeSets.value = justFinished.sets
    justFinishedWorkout.value = null
    justFinishedWorkoutId.value = null
    persistActiveWorkoutId(justFinished.id)
  }

  // Called when the user opts to start a new workout instead of resuming the
  // one they just finished — a non-destructive dismissal, unlike
  // discardRecoverableWorkout below (the just-finished workout stays exactly
  // as finished; only the resume offer goes away).
  function dismissJustFinishedWorkout() {
    justFinishedWorkoutId.value = null
    justFinishedWorkout.value = null
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

  // Backlog item 1: exercise-by-exercise history detail (ExerciseHistoryDetail.vue),
  // opened from the Exercises tab and the active logger. Same query shape as
  // fetchPreviousWorkout above (base table `workouts`, `sets!inner` embed) --
  // ordering a base-table query by an embedded table's column (sets as the
  // base table, ordering by the embedded workout's performed_at) silently
  // failed to actually sort by it, so this goes through workouts instead,
  // filtering the embedded sets down to just this exercise via
  // `.eq('sets.exercise_id', ...)` (a `!inner` embed filter narrows the
  // nested array itself, not just which parent rows qualify).
  const exerciseHistory = ref<ExerciseHistoryWorkout[]>([])
  const exerciseHistoryLoading = ref(false)
  const exerciseHistoryError = ref('')

  async function fetchExerciseHistory(exerciseId: string) {
    exerciseHistoryLoading.value = true
    exerciseHistoryError.value = ''

    const { data, error } = await supabase
      .from('workouts')
      .select('id, performed_at, sets!inner(id, reps, weight, weight_unit, rpe)')
      .eq('sets.exercise_id', exerciseId)
      .order('performed_at', { ascending: false })
      .order('set_index', { foreignTable: 'sets', ascending: true })

    if (error) {
      exerciseHistoryError.value = error.message
      exerciseHistoryLoading.value = false
      return
    }

    type Row = {
      id: string
      performed_at: string
      sets: { id: string; reps: number; weight: number; weight_unit: WeightUnit; rpe: number | null }[]
    }

    exerciseHistory.value = ((data ?? []) as unknown as Row[]).map((row) => ({
      workoutId: row.id,
      performedAt: row.performed_at,
      sets: row.sets,
    }))
    exerciseHistoryLoading.value = false
  }

  function clearExerciseHistory() {
    exerciseHistory.value = []
    exerciseHistoryError.value = ''
  }

  // Redesign item 67: ranks the add-exercise sheet's "Recently logged"
  // section by actual recency only (no muscle-group/goal tagging exists to
  // do better — see docs/backlog.md item 67's canvas note n4). Reads the
  // most recent 300 sets' exercise ids in performed_at order and dedupes
  // client-side rather than a DB-side GROUP BY, which PostgREST has no
  // query-builder support for.
  const recentlyLoggedExerciseIds = ref<string[]>([])

  async function fetchRecentlyLoggedExercises() {
    const { data, error } = await supabase
      .from('sets')
      .select('exercise_id, workouts!inner(performed_at)')
      .order('performed_at', { foreignTable: 'workouts', ascending: false })
      .limit(300)
    if (error || !data) return

    const seen = new Set<string>()
    const ids: string[] = []
    for (const row of data as unknown as { exercise_id: string }[]) {
      if (seen.has(row.exercise_id)) continue
      seen.add(row.exercise_id)
      ids.push(row.exercise_id)
    }
    recentlyLoggedExerciseIds.value = ids
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
    activeWorkoutStartedAt,
    activeSets,
    previousWorkout,
    recoverableWorkout,
    justFinishedWorkoutId,
    justFinishedWorkout,
    volumeHistory,
    volumeHistoryError,
    exerciseHistory,
    exerciseHistoryLoading,
    exerciseHistoryError,
    recentlyLoggedExerciseIds,
    fetchRecentlyLoggedExercises,
    newRecord,
    workoutsThisWeek,
    workoutDaysThisWeek,
    recentPr,
    startWorkout,
    checkForRecoverableWorkout,
    resumeRecoverableWorkout,
    discardRecoverableWorkout,
    fetchJustFinishedWorkout,
    resumeJustFinishedWorkout,
    dismissJustFinishedWorkout,
    resetActiveWorkoutState,
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
    fetchExerciseHistory,
    clearExerciseHistory,
    fetchProgressStats,
  }
})
