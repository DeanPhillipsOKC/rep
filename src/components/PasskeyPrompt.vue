<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const errorMessage = ref('')
const dismissed = ref(false)

async function handleRegister() {
  errorMessage.value = ''
  const { error } = await auth.registerPasskey()
  if (error) {
    errorMessage.value = error.message
  }
}
</script>

<template>
  <div v-if="!dismissed">
    <p>
      Set up a passkey so you can sign in with Face ID / your fingerprint next time, instead
      of waiting on an email.
    </p>
    <button type="button" @click="handleRegister">Register a passkey</button>
    <button type="button" @click="dismissed = true">Not now</button>
    <p v-if="errorMessage">{{ errorMessage }}</p>
  </div>
</template>
