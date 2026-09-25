<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { pickCelebration } from '../lib/celebration'
import type { WeightUnit } from '../lib/types'

// Backlog item 38: full-screen takeover replacing the old bottom-of-screen
// ".record-toast" (docs/backlog-archive.md item 4) with a real "good job"
// moment. Built to the approved mockup
// (https://claude.ai/artifact/Cr63WNz2AZF4pixzBE1CM5), adapted to require an
// explicit dismiss (button or a tap on the overlay) rather than the
// mockup's auto-fade timer — the user chose to have this interrupt the
// logging flow rather than disappear on its own.
const props = defineProps<{
  exerciseName: string
  reps: number
  weight: number
  weightUnit: WeightUnit
  previousBest: number
}>()

const emit = defineEmits<{
  (e: 'dismiss'): void
}>()

// Picked once per mount (v-if="recordCelebration" in WorkoutLogger.vue
// remounts this fresh per record), same pattern as RestTimer.vue's
// once-per-mount encouragement pick.
const variant = pickCelebration()

const volume = props.reps * props.weight
const isFirstEver = props.previousBest === 0
const delta = Math.round(volume - props.previousBest)

const dismissButton = ref<HTMLButtonElement | null>(null)

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('dismiss')
}

onMounted(() => {
  dismissButton.value?.focus()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div
    class="celebration-overlay"
    role="dialog"
    aria-modal="true"
    :aria-label="`New record: ${exerciseName}`"
    @click="emit('dismiss')"
  >
    <svg class="celebration-burst" viewBox="0 0 400 400" aria-hidden="true">
      <g stroke="var(--highlight)" stroke-width="3" stroke-linecap="round">
        <line x1="200" y1="200" x2="200" y2="20" />
        <line x1="200" y1="200" x2="330" y2="70" />
        <line x1="200" y1="200" x2="380" y2="200" />
        <line x1="200" y1="200" x2="330" y2="330" />
        <line x1="200" y1="200" x2="200" y2="380" />
        <line x1="200" y1="200" x2="70" y2="330" />
        <line x1="200" y1="200" x2="20" y2="200" />
        <line x1="200" y1="200" x2="70" y2="70" />
      </g>
    </svg>

    <div v-for="i in 10" :key="i" class="confetti" :class="`confetti-${i - 1}`" aria-hidden="true"></div>

    <div class="celebration-content">
      <div class="celebration-badge">
        <svg class="celebration-star" width="14" height="14" viewBox="0 0 24 24" fill="var(--highlight)">
          <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
        </svg>
        New record
        <svg
          class="celebration-star celebration-star-2"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="var(--highlight)"
        >
          <path d="M12 0 L14.5 9.5 L24 12 L14.5 14.5 L12 24 L9.5 14.5 L0 12 L9.5 9.5 Z" />
        </svg>
      </div>

      <img class="celebration-mascot" :src="variant.image" alt="" />

      <p class="celebration-headline">{{ variant.phrase }}</p>

      <div class="celebration-stat-card">
        <div class="celebration-exercise">{{ exerciseName }}</div>
        <div class="celebration-numbers">{{ weight }} {{ weightUnit }} &times; {{ reps }}</div>
        <div class="celebration-delta">
          <template v-if="isFirstEver">First one logged for this exercise</template>
          <template v-else>+{{ delta }} {{ weightUnit }}-reps of volume over your last best</template>
        </div>
      </div>

      <button ref="dismissButton" type="button" class="celebration-dismiss" @click.stop="emit('dismiss')">
        Nice!
      </button>
    </div>
  </div>
</template>

<style scoped>
.celebration-overlay {
  position: fixed;
  inset: 0;
  z-index: 60;
  overflow: hidden;
  background: radial-gradient(circle at 50% 38%, var(--surface-2) 0%, var(--bg) 62%, #140f16 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 30px;
}

.celebration-burst {
  position: absolute;
  left: 50%;
  top: 36%;
  width: 560px;
  height: 560px;
  transform: translate(-50%, -50%);
  opacity: 0.28;
  animation: celebration-ray-rotate 22s linear infinite;
}

.confetti {
  position: absolute;
  top: -20px;
  border-radius: 2px;
  animation: celebration-confetti-fall linear forwards;
}

.confetti-0 {
  left: 8%;
  width: 10px;
  height: 16px;
  background: var(--accent);
  animation-duration: 2.6s;
  animation-delay: 0.1s;
}
.confetti-1 {
  left: 20%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--highlight);
  animation-duration: 3.1s;
  animation-delay: 0.4s;
}
.confetti-2 {
  left: 34%;
  width: 9px;
  height: 14px;
  background: var(--success);
  animation-duration: 2.8s;
  animation-delay: 0.05s;
}
.confetti-3 {
  left: 48%;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--secondary);
  animation-duration: 2.4s;
  animation-delay: 0.55s;
}
.confetti-4 {
  left: 62%;
  width: 10px;
  height: 15px;
  background: var(--highlight);
  animation-duration: 3s;
  animation-delay: 0.2s;
}
.confetti-5 {
  left: 74%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
  animation-duration: 2.7s;
  animation-delay: 0.35s;
}
.confetti-6 {
  left: 86%;
  width: 9px;
  height: 13px;
  background: var(--success);
  animation-duration: 2.9s;
  animation-delay: 0.5s;
}
.confetti-7 {
  left: 14%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--secondary);
  animation-duration: 3.2s;
  animation-delay: 0.65s;
}
.confetti-8 {
  left: 92%;
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--accent);
  animation-duration: 2.5s;
  animation-delay: 0.15s;
}
.confetti-9 {
  left: 56%;
  width: 8px;
  height: 12px;
  background: var(--text);
  animation-duration: 3.3s;
  animation-delay: 0.3s;
}

.celebration-content {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
  width: 100%;
  max-width: 340px;
}

.celebration-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--highlight);
}

.celebration-star {
  animation: celebration-sparkle 1.6s ease-in-out infinite;
}

.celebration-star-2 {
  animation-delay: 0.4s;
}

.celebration-mascot {
  width: 176px;
  height: 176px;
  object-fit: contain;
  filter: drop-shadow(0 10px 24px rgba(0, 0, 0, 0.45));
  animation: celebration-bounce-in 0.62s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}

.celebration-headline {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
  line-height: 1.2;
}

.celebration-stat-card {
  width: 100%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.celebration-exercise {
  font-size: 0.9rem;
  color: var(--text-dim);
}

.celebration-numbers {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text);
}

.celebration-delta {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--success);
}

.celebration-dismiss {
  width: 100%;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.celebration-dismiss:active {
  background: var(--accent-pressed);
  border-color: var(--accent-pressed);
}

@keyframes celebration-bounce-in {
  0% {
    transform: scale(0.35) rotate(-6deg);
    opacity: 0;
  }
  55% {
    transform: scale(1.1) rotate(2deg);
    opacity: 1;
  }
  75% {
    transform: scale(0.95) rotate(-1deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
  }
}

@keyframes celebration-confetti-fall {
  0% {
    transform: translateY(-30px) rotate(0deg);
    opacity: 0;
  }
  12% {
    opacity: 1;
  }
  100% {
    transform: translateY(760px) rotate(340deg);
    opacity: 0;
  }
}

@keyframes celebration-ray-rotate {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes celebration-sparkle {
  0%,
  100% {
    opacity: 0.25;
    transform: scale(0.8);
  }
  50% {
    opacity: 1;
    transform: scale(1.15);
  }
}
</style>
