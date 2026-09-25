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
    <div class="glow glow-pink" aria-hidden="true"></div>

    <div class="content">
      <div class="icon-ring">
        <div class="icon-circle">
          <svg viewBox="0 0 24 24" width="38" height="38" fill="none" aria-hidden="true">
            <path
              d="M12 3a7 7 0 00-7 7v2c0 3 1 5 2 6.5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path d="M12 3a7 7 0 017 7v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
            <path
              d="M8 10a4 4 0 018 0v2c0 3.5-1 6-3 8"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              d="M10.5 10a1.5 1.5 0 013 0v2.5c0 2.5-0.6 4.3-1.8 5.8"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path d="M5.5 10a6.5 6.5 0 011-3.6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
          </svg>
        </div>
      </div>

      <h1 class="heading">Welcome back</h1>
      <p class="subtitle">Sign in to keep hopping.</p>

      <button
        v-if="auth.supportsPasskeys()"
        type="button"
        class="passkey-btn"
        @click="handlePasskeySignIn"
      >
        <svg viewBox="0 0 24 24" width="17" height="17" fill="none" aria-hidden="true">
          <path
            d="M12 3a7 7 0 00-7 7v2c0 3 1 5 2 6.5"
            stroke="var(--accent-text)"
            stroke-width="1.8"
            stroke-linecap="round"
          />
          <path d="M12 3a7 7 0 017 7v2" stroke="var(--accent-text)" stroke-width="1.8" stroke-linecap="round" />
          <path
            d="M8 10a4 4 0 018 0v2c0 3.5-1 6-3 8"
            stroke="var(--accent-text)"
            stroke-width="1.8"
            stroke-linecap="round"
          />
        </svg>
        Sign in with passkey
      </button>

      <div class="divider" v-if="auth.supportsPasskeys()"><span>OR</span></div>

      <form class="email-form" @submit.prevent="handleMagicLink">
        <label for="email">Email</label>
        <input
          id="email"
          v-model="email"
          type="email"
          required
          autocomplete="email"
          placeholder="you@example.com"
        />
        <button type="submit" class="magic-link-btn" :disabled="status === 'sending'">
          Email me a magic link
        </button>
      </form>

      <p v-if="status === 'sent'" class="hint">Check your email for a sign-in link.</p>
      <p v-if="status === 'error'" class="error">{{ errorMessage }}</p>

      <p v-if="auth.supportsPasskeys()" class="footnote">
        Passkeys use your device's built-in security — no password to remember.
      </p>
    </div>
  </div>
</template>

<style scoped>
.screen {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: radial-gradient(120% 70% at 50% 0%, #3a2745 0%, var(--bg) 58%);
}

.glow {
  position: absolute;
  left: 50%;
  top: 96px;
  width: 260px;
  height: 260px;
  transform: translateX(-50%);
  border-radius: 50%;
  pointer-events: none;
  background: radial-gradient(circle, rgba(242, 135, 156, 0.3) 0%, rgba(242, 135, 156, 0) 70%);
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
  padding: 88px 32px 48px;
}

.icon-ring {
  position: relative;
  width: 104px;
  height: 104px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-circle {
  position: relative;
  width: 88px;
  height: 88px;
  border-radius: 50%;
  background: var(--surface-2);
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.heading {
  font-size: 1.6rem;
  margin: 18px 0 0;
}

.subtitle {
  margin: 6px 0 0;
  text-align: center;
}

.passkey-btn {
  width: 100%;
  margin-top: 30px;
  padding: 17px;
  border-radius: 999px;
  background: var(--accent);
  border: none;
  color: var(--accent-text);
  font-weight: 800;
  font-size: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  box-shadow: 0 16px 30px -12px rgba(242, 135, 156, 0.5);
}

.passkey-btn:active {
  background: var(--accent-pressed);
}

.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-top: 26px;
  color: var(--text-dim);
  font-size: 0.75rem;
  font-weight: 700;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.email-form {
  width: 100%;
  margin-top: 22px;
}

.magic-link-btn {
  width: 100%;
  margin-top: 12px;
  background: transparent;
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  color: var(--text);
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

.footnote {
  font-size: 0.72rem;
  color: var(--text-dim);
  text-align: center;
  margin: 22px 0 0;
  line-height: 1.5;
}
</style>
