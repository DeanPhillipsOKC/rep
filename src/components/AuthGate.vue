<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '../stores/auth'
import LoginForm from './LoginForm.vue'
import PasskeyPrompt from './PasskeyPrompt.vue'

const auth = useAuthStore()

onMounted(() => {
  auth.init()
})
</script>

<template>
  <p v-if="auth.loading" class="loading">Loading…</p>
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
