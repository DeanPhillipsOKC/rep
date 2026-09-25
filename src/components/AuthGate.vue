<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useAuthStore } from '../stores/auth'
import { useWorkoutsStore } from '../stores/workouts'
import LoginForm from './LoginForm.vue'
import OnboardingScreen from './OnboardingScreen.vue'
import PasskeyPrompt from './PasskeyPrompt.vue'

const ONBOARDING_SEEN_KEY = 'repbunny-onboarding-seen'

// Cycled while auth.loading is true (session lookup is normally near-instant,
// but a cold PWA boot on a slow connection can sit here for a couple of
// seconds, so more than one line is worth showing).
const LOADING_CAPTIONS = [
  'Lacing up your paws…',
  'Racking the plates…',
  'Counting your reps…',
  'Warming up…'
]

const auth = useAuthStore()
const workout = useWorkoutsStore()
const hasSeenOnboarding = ref(localStorage.getItem(ONBOARDING_SEEN_KEY) === '1')
const captionIndex = ref(0)
let captionTimer: ReturnType<typeof setInterval> | undefined

// Recover-interrupted-workout item: this is the earliest point a signed-in
// user id actually exists, so it's the natural boot hook for "is there an
// active workout to offer resuming." Also fires the other way on sign-out
// (explicit click or session expiry both flow through auth.isSignedIn) so a
// second account signing in on the same device never inherits the first
// account's in-progress session or resume prompt. Deliberately not
// `immediate: true` — isSignedIn's initial value is always false before
// auth.init() resolves, and firing resetActiveWorkoutState() on that first
// tick would clear the persisted reference before the real, post-init
// sign-in transition ever gets a chance to check it.
watch(
  () => auth.isSignedIn,
  (signedIn) => {
    if (signedIn) workout.checkForRecoverableWorkout()
    else workout.resetActiveWorkoutState()
  },
)

onMounted(() => {
  auth.init()
  captionTimer = setInterval(() => {
    captionIndex.value = (captionIndex.value + 1) % LOADING_CAPTIONS.length
  }, 2200)
})

onUnmounted(() => {
  clearInterval(captionTimer)
})

function completeOnboarding() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  hasSeenOnboarding.value = true
}
</script>

<template>
  <div v-if="auth.loading" class="loading" role="status" aria-live="polite">
    <div class="glow glow-pink" aria-hidden="true"></div>
    <div class="glow glow-lavender" aria-hidden="true"></div>

    <div class="badge">
      <span class="ring ring-1" aria-hidden="true"></span>
      <span class="ring ring-2" aria-hidden="true"></span>
      <span class="ring ring-3" aria-hidden="true"></span>
      <img src="/loading-bunny.webp" alt="" width="128" height="151" class="mascot" />
    </div>

    <h1 class="wordmark">RepBunny</h1>
    <p class="caption">{{ LOADING_CAPTIONS[captionIndex] }}</p>

    <div class="paws" aria-hidden="true">
      <svg viewBox="0 0 24 24" class="paw paw-1">
        <ellipse cx="12" cy="16" rx="5.5" ry="4.2" /><ellipse cx="6" cy="9" rx="2.1" ry="2.6" />
        <ellipse cx="11" cy="6.5" rx="2.1" ry="2.6" /><ellipse cx="16.2" cy="7.5" rx="2" ry="2.5" />
        <ellipse cx="19" cy="11.5" rx="1.8" ry="2.3" />
      </svg>
      <svg viewBox="0 0 24 24" class="paw paw-2">
        <ellipse cx="12" cy="16" rx="5.5" ry="4.2" /><ellipse cx="6" cy="9" rx="2.1" ry="2.6" />
        <ellipse cx="11" cy="6.5" rx="2.1" ry="2.6" /><ellipse cx="16.2" cy="7.5" rx="2" ry="2.5" />
        <ellipse cx="19" cy="11.5" rx="1.8" ry="2.3" />
      </svg>
      <svg viewBox="0 0 24 24" class="paw paw-3">
        <ellipse cx="12" cy="16" rx="5.5" ry="4.2" /><ellipse cx="6" cy="9" rx="2.1" ry="2.6" />
        <ellipse cx="11" cy="6.5" rx="2.1" ry="2.6" /><ellipse cx="16.2" cy="7.5" rx="2" ry="2.5" />
        <ellipse cx="19" cy="11.5" rx="1.8" ry="2.3" />
      </svg>
    </div>
  </div>
  <OnboardingScreen
    v-else-if="!auth.isSignedIn && !hasSeenOnboarding"
    @continue="completeOnboarding"
  />
  <LoginForm v-else-if="!auth.isSignedIn" />
  <div v-else>
    <PasskeyPrompt v-if="!auth.hasPasskey" />
    <slot />
  </div>
</template>

<style scoped>
.loading {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px;
  text-align: center;
  background: radial-gradient(120% 70% at 50% 8%, #3a2745 0%, var(--bg) 62%);
}

.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.glow-pink {
  left: -60px;
  top: 120px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(242, 135, 156, 0.28) 0%, rgba(242, 135, 156, 0) 70%);
}

.glow-lavender {
  right: -70px;
  top: 280px;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgba(183, 156, 240, 0.22) 0%, rgba(183, 156, 240, 0) 70%);
}

.badge {
  position: relative;
  z-index: 1;
  width: 200px;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring {
  position: absolute;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  border: 2px solid var(--accent);
  animation: ring-pulse 2s cubic-bezier(0.2, 0.6, 0.35, 1) infinite;
}

.ring-2 {
  animation-delay: 0.66s;
}

.ring-3 {
  animation-delay: 1.32s;
}

.mascot {
  position: relative;
  width: 128px;
  height: auto;
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.5));
  animation: mascot-breathe 2s ease-in-out infinite;
}

.wordmark {
  position: relative;
  z-index: 1;
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 1.7rem;
  color: var(--text);
  letter-spacing: 0.4px;
  margin: 20px 0 0;
}

.caption {
  position: relative;
  z-index: 1;
  font-weight: 500;
  font-style: italic;
  font-size: 0.92rem;
  color: var(--text-dim);
  margin: 8px 0 0;
}

.paws {
  position: relative;
  z-index: 1;
  display: flex;
  gap: 12px;
  margin-top: 18px;
}

.paw {
  width: 15px;
  height: 15px;
  fill: var(--accent);
  animation: paw-step 1.15s ease-in-out infinite;
}

.paw-2 {
  animation-delay: 0.15s;
}

.paw-3 {
  animation-delay: 0.3s;
}

@keyframes ring-pulse {
  0% {
    transform: scale(0.72);
    opacity: 0.55;
  }
  100% {
    transform: scale(1.55);
    opacity: 0;
  }
}

@keyframes mascot-breathe {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.035);
  }
}

@keyframes paw-step {
  0%,
  60%,
  100% {
    opacity: 0.28;
    transform: translateY(0);
  }
  30% {
    opacity: 1;
    transform: translateY(-5px);
  }
}

@media (prefers-reduced-motion: reduce) {
  .ring,
  .mascot,
  .paw {
    animation: none;
  }
}
</style>
