<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAuthStore } from '../stores/auth'
import LoginForm from './LoginForm.vue'
import OnboardingScreen from './OnboardingScreen.vue'
import PasskeyPrompt from './PasskeyPrompt.vue'

const ONBOARDING_SEEN_KEY = 'repbunny-onboarding-seen'

const auth = useAuthStore()
const hasSeenOnboarding = ref(localStorage.getItem(ONBOARDING_SEEN_KEY) === '1')

onMounted(() => {
  auth.init()
})

function completeOnboarding() {
  localStorage.setItem(ONBOARDING_SEEN_KEY, '1')
  hasSeenOnboarding.value = true
}
</script>

<template>
  <p v-if="auth.loading" class="loading">Loading…</p>
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
  padding: 24px;
  text-align: center;
}
</style>
