<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const email = ref('')
const status = ref<'idle' | 'sending' | 'sent' | 'error'>('idle')
const errorMessage = ref('')

async function handleMagicLink() {
  status.value = 'sending'
  errorMessage.value = ''
  const { error } = await auth.sendMagicLink(email.value)
  if (error) {
    status.value = 'error'
    errorMessage.value = error.message
  } else {
    status.value = 'sent'
  }
}

async function handlePasskeySignIn() {
  errorMessage.value = ''
  const { error } = await auth.signInWithPasskey()
  if (error) {
    errorMessage.value = error.message
  }
}
</script>

<template>
  <div>
    <h1>Workout Tracker</h1>

    <button v-if="auth.supportsPasskeys()" type="button" @click="handlePasskeySignIn">
      Sign in with passkey
    </button>

    <form @submit.prevent="handleMagicLink">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" required autocomplete="email" />
      <button type="submit" :disabled="status === 'sending'">Email me a sign-in link</button>
    </form>

    <p v-if="status === 'sent'">Check your email for a sign-in link.</p>
    <p v-if="status === 'error'">{{ errorMessage }}</p>
  </div>
</template>
