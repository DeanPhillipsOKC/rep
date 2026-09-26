<script setup lang="ts">
import { computed, ref } from 'vue'

// Redesign item 67: replaces the suggested-exercise chip row and the
// exercise <select> with a bottom sheet opened from the carousel's
// persistent "+". Ranks its default (no search text) list by recency only —
// there's no muscle-group/goal tagging on exercises to do a real "good for
// leg day" recommendation, and reaching for AI-based recommendation is
// explicitly out of scope (see docs/backlog.md item 67's canvas note n4).
// `exercises` is already scoped by the caller to whatever isn't in the
// active workout's carousel deck yet -- including exercises outside the
// active template, since the "+" is deliberately how an ad-hoc addition to a
// templated workout happens now (superseding item 21's stricter dropdown
// scoping, which only ever applied to the auto-populated deck).
const props = defineProps<{
  exercises: { id: string; name: string }[]
  recentIds: string[]
}>()

const emit = defineEmits<{
  select: [id: string]
  dismiss: []
  manage: []
}>()

const query = ref('')

const filteredResults = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return []
  return props.exercises.filter((e) => e.name.toLowerCase().includes(q))
})

const RECENT_SECTION_SIZE = 5

// Recently-logged entries first (in actual recency order), then padded with
// not-yet-logged exercises so a brand-new account's sheet isn't empty.
const recentSection = computed(() => {
  const byId = new Map(props.exercises.map((e) => [e.id, e]))
  const result: { id: string; name: string; recent: boolean }[] = []

  for (const id of props.recentIds) {
    const exercise = byId.get(id)
    if (!exercise) continue
    result.push({ id: exercise.id, name: exercise.name, recent: true })
    if (result.length >= RECENT_SECTION_SIZE) return result
  }
  for (const exercise of props.exercises) {
    if (result.some((r) => r.id === exercise.id)) continue
    result.push({ id: exercise.id, name: exercise.name, recent: false })
    if (result.length >= RECENT_SECTION_SIZE) break
  }
  return result
})

const remainingSection = computed(() => {
  const shown = new Set(recentSection.value.map((r) => r.id))
  return props.exercises.filter((e) => !shown.has(e.id))
})
</script>

<template>
  <div class="sheet-overlay" @click.self="emit('dismiss')">
    <div class="sheet" role="dialog" aria-modal="true" aria-label="Add exercise">
      <div class="sheet-handle" aria-hidden="true"></div>
      <div class="sheet-header">
        <h3>Add exercise</h3>
        <button type="button" class="sheet-close" aria-label="Close" @click="emit('dismiss')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" />
          </svg>
        </button>
      </div>

      <label class="sheet-search">
        <span class="sr-only">Search exercises</span>
        <input v-model="query" type="search" placeholder="Search exercises" />
      </label>

      <div class="sheet-body">
        <template v-if="query.trim()">
          <p v-if="filteredResults.length === 0" class="row-sub">No exercises match "{{ query }}".</p>
          <div v-else class="sheet-section">
            <button
              v-for="exercise in filteredResults"
              :key="exercise.id"
              type="button"
              class="sheet-item"
              :aria-label="exercise.name"
              @click="emit('select', exercise.id)"
            >
              <span aria-hidden="true">{{ exercise.name }}</span>
            </button>
          </div>
        </template>

        <template v-else>
          <p v-if="exercises.length === 0" class="row-sub">All your exercises are already in this workout.</p>

          <div v-if="recentSection.length > 0" class="sheet-section">
            <span class="sheet-section-label">Recently logged</span>
            <button
              v-for="exercise in recentSection"
              :key="exercise.id"
              type="button"
              class="sheet-item"
              :aria-label="exercise.name"
              @click="emit('select', exercise.id)"
            >
              <span aria-hidden="true" class="sheet-item-name">{{ exercise.name }}</span>
              <span aria-hidden="true" class="sheet-item-sub">
                {{ exercise.recent ? 'Logged recently' : 'New · not logged yet' }}
              </span>
            </button>
          </div>

          <div v-if="remainingSection.length > 0" class="sheet-section">
            <span class="sheet-section-label">All exercises</span>
            <button
              v-for="exercise in remainingSection"
              :key="exercise.id"
              type="button"
              class="sheet-item sheet-item-compact"
              :aria-label="exercise.name"
              @click="emit('select', exercise.id)"
            >
              <span aria-hidden="true">{{ exercise.name }}</span>
            </button>
          </div>
        </template>
      </div>

      <button type="button" class="link-button sheet-manage-link" @click="emit('manage')">
        Can't find it? Manage exercises
      </button>
    </div>
  </div>
</template>

<style scoped>
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 480px;
  max-height: 82vh;
  background: var(--bg);
  border: 1px solid var(--border);
  border-bottom: none;
  border-radius: 20px 20px 0 0;
  padding: 10px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sheet-handle {
  align-self: center;
  width: 36px;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sheet-header h3 {
  margin: 0;
  font-family: var(--font-display, inherit);
}

.sheet-close {
  width: 34px;
  height: 34px;
  min-height: auto;
  padding: 0;
  border-radius: 50%;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-dim);
  display: flex;
  align-items: center;
  justify-content: center;
}

.sheet-search input {
  width: 100%;
  height: 44px;
  padding: 0 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 0.95rem;
}

.sheet-body {
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sheet-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.sheet-section-label {
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.07em;
  color: var(--text-dim);
  text-transform: uppercase;
  padding: 0 2px;
}

.sheet-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  padding: 12px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  text-align: left;
}

.sheet-item-compact {
  background: var(--surface);
}

.sheet-item-name {
  font-size: 0.95rem;
  font-weight: 700;
}

.sheet-item-sub {
  font-size: 0.72rem;
  color: var(--text-dim);
}

.sheet-manage-link {
  align-self: center;
  font-size: 0.85rem;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
