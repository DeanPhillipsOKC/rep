<script setup lang="ts">
import AuthGate from './components/AuthGate.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
</script>

<template>
  <main>
    <AuthGate>
      <h1>Workout Tracker</h1>
      <p>Signed in. Workout logging comes next.</p>
      <button type="button" @click="auth.signOut()">Sign out</button>
    </AuthGate>
  </main>
</template>
