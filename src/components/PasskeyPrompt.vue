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
  <div v-if="!dismissed" class="prompt">
    <p>
      Set up a passkey so you can sign in with Face ID / your fingerprint next time, instead of
      waiting on an email.
    </p>
    <div class="actions">
      <button type="button" class="primary" @click="handleRegister">Register a passkey</button>
      <button type="button" class="ghost" @click="dismissed = true">Not now</button>
    </div>
    <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
  </div>
</template>

<style scoped>
.prompt {
  margin: 16px;
  padding: 16px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.actions {
  display: flex;
  gap: 8px;
}

.primary {
  flex: 2;
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-text);
}

.ghost {
  flex: 1;
  background: transparent;
  color: var(--text-dim);
}

.error {
  margin-top: 12px;
  margin-bottom: 0;
  color: var(--danger);
}
</style>
