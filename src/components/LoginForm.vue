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
  <div class="screen">
    <div class="brand">
      <img src="/icon-192.png" alt="" class="brand-logo" />
      <h1>RepBunny</h1>
      <p class="tagline">Small wins. Stronger every set.</p>
    </div>

    <button
      v-if="auth.supportsPasskeys()"
      type="button"
      class="primary"
      @click="handlePasskeySignIn"
    >
      Sign in with passkey
    </button>

    <div class="divider" v-if="auth.supportsPasskeys()"><span>or</span></div>

    <form class="card" @submit.prevent="handleMagicLink">
      <label for="email">Email</label>
      <input id="email" v-model="email" type="email" required autocomplete="email" />
      <button type="submit" :disabled="status === 'sending'">Email me a sign-in link</button>
    </form>

    <p v-if="status === 'sent'" class="hint">Check your email for a sign-in link.</p>
    <p v-if="status === 'error'" class="error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.screen {
  max-width: 480px;
  margin: 0 auto;
  padding: 48px 16px;
}

.brand {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 24px;
}

.brand-logo {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  margin-bottom: 12px;
}

.screen h1 {
  text-align: center;
  margin: 0;
}

.tagline {
  margin: 4px 0 0;
  color: var(--text-dim);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  text-align: center;
}

.primary {
  width: 100%;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 20px 0;
  color: var(--text-dim);
  font-size: 0.8rem;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 16px;
}

.hint {
  margin-top: 16px;
  text-align: center;
}

.error {
  margin-top: 16px;
  text-align: center;
  color: var(--danger);
}
</style>
