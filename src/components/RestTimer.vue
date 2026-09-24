<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

// Backlog item 28: in-app rest screen shown after logging a set for an
// exercise with rest_seconds configured. Distinct from item 15's push
// notification (src/stores/pushSubscription.ts), which stays as the
// backgrounded-tab fallback — see the visibility check in WorkoutLogger.vue's
// handleAddSet for how the two are kept from firing together.

const props = defineProps<{
  exerciseName: string
  restSeconds: number
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

const remaining = ref(props.restSeconds)
let intervalId: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  // Computed from a fixed end time rather than decremented per tick, so an
  // interval delayed by tab throttling still reports the correct remaining
  // time instead of drifting slow.
  const endsAt = Date.now() + props.restSeconds * 1000
  intervalId = setInterval(() => {
    const secondsLeft = Math.max(0, Math.round((endsAt - Date.now()) / 1000))
    remaining.value = secondsLeft
    if (secondsLeft <= 0) {
      clearInterval(intervalId)
      navigator.vibrate?.(200)
      emit('dismiss')
    }
  }, 250)
})

onUnmounted(() => {
  clearInterval(intervalId)
})

const remainingLabel = computed(() => {
  const m = Math.floor(remaining.value / 60)
  const s = remaining.value % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const progressPercent = computed(() => (remaining.value / props.restSeconds) * 100)
</script>

<template>
  <div class="rest-overlay" role="status" aria-live="polite">
    <div class="rest-badge">
      <span class="rest-dot"></span>
      <span class="rest-badge-label">Resting</span>
    </div>

    <div class="rest-hero">
      <div class="rest-glow-wrap">
        <div class="rest-glow"></div>
        <img src="/rest-bunny.png" alt="" class="rest-bunny" />
      </div>

      <div class="rest-copy">
        <p class="rest-headline">Nice work — take a breather</p>
        <p class="rest-countdown">{{ remainingLabel }}</p>
        <p class="rest-context">Next: {{ exerciseName }}</p>
      </div>
    </div>

    <div class="rest-footer">
      <div class="rest-progress-track">
        <div class="rest-progress-fill" :style="{ width: `${progressPercent}%` }"></div>
      </div>
      <button type="button" class="rest-skip" @click="emit('dismiss')">Skip Rest</button>
    </div>
  </div>
</template>

<style scoped>
.rest-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  background: var(--bg);
  color: var(--text);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  padding: 56px 28px 40px;
}

.rest-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
}

.rest-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation: rest-pulse-dot 1.6s ease-in-out infinite;
}

.rest-badge-label {
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-dim);
}

.rest-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 28px;
}

.rest-glow-wrap {
  position: relative;
  width: 220px;
  height: 220px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rest-glow {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 138, 160, 0.35) 0%, rgba(229, 138, 160, 0) 70%);
  filter: blur(2px);
  animation: rest-breathe 4s ease-in-out infinite;
}

.rest-bunny {
  width: 168px;
  height: 168px;
  object-fit: contain;
  position: relative;
  animation: rest-breathe 4s ease-in-out infinite;
}

.rest-copy {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.rest-headline {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text);
}

.rest-countdown {
  margin: 0;
  font-size: 4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
  color: var(--text);
}

.rest-context {
  margin: 0;
  font-size: 0.875rem;
  color: var(--text-dim);
  text-align: center;
}

.rest-footer {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.rest-progress-track {
  width: 100%;
  max-width: 280px;
  height: 10px;
  border-radius: 999px;
  background: var(--surface-2);
  overflow: hidden;
}

.rest-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--accent);
  transition: width 0.25s linear;
}

.rest-skip {
  width: 100%;
  max-width: 300px;
  background: var(--surface);
}

@keyframes rest-breathe {
  0%,
  100% {
    transform: translateY(0) scale(1);
  }
  50% {
    transform: translateY(-6px) scale(1.035);
  }
}

@keyframes rest-pulse-dot {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.35;
  }
}
</style>
