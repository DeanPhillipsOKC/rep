<script setup lang="ts">
import { ref } from 'vue'
import AuthGate from './components/AuthGate.vue'
import ExerciseList from './components/ExerciseList.vue'
import TemplateManager from './components/TemplateManager.vue'
import WorkoutHistory from './components/WorkoutHistory.vue'
import WorkoutLogger from './components/WorkoutLogger.vue'
import { useAuthStore } from './stores/auth'

const auth = useAuthStore()
const view = ref<'log' | 'exercises' | 'templates' | 'history'>('log')
const appVersion = __APP_VERSION__
</script>

<template>
  <main>
    <AuthGate>
      <header class="app-header">
        <h1>REP</h1>
        <button type="button" class="ghost" @click="auth.signOut()">Sign out</button>
      </header>

      <nav class="tabs">
        <button type="button" :class="{ active: view === 'log' }" @click="view = 'log'">Log</button>
        <button type="button" :class="{ active: view === 'exercises' }" @click="view = 'exercises'">
          Exercises
        </button>
        <button type="button" :class="{ active: view === 'templates' }" @click="view = 'templates'">
          Templates
        </button>
        <button type="button" :class="{ active: view === 'history' }" @click="view = 'history'">
          History
        </button>
      </nav>

      <section class="content">
        <WorkoutLogger v-if="view === 'log'" />
        <ExerciseList v-else-if="view === 'exercises'" />
        <TemplateManager v-else-if="view === 'templates'" />
        <WorkoutHistory v-else-if="view === 'history'" />
      </section>
    </AuthGate>

    <footer class="app-version">{{ appVersion }}</footer>
  </main>
</template>

<style scoped>
main {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  padding-bottom: 32px;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.app-header h1 {
  margin: 0;
}

.app-header .ghost {
  min-height: auto;
  padding: 8px 12px;
  background: transparent;
  border-color: transparent;
  color: var(--text-dim);
  font-weight: 500;
}

.tabs {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
  background: var(--bg);
}

.tabs button {
  flex: 1;
  background: var(--surface);
  border-color: var(--border);
  color: var(--text-dim);
}

.tabs button.active {
  background: var(--surface-2);
  color: var(--text);
  border-color: var(--accent);
}

.content {
  padding: 0 16px;
}

.app-version {
  padding: 24px 16px 12px;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-dim);
  opacity: 0.6;
}
</style>
