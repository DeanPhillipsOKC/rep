<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import AuthGate from './components/AuthGate.vue'
import BottomNav from './components/BottomNav.vue'
import { useAuthStore } from './stores/auth'
import type { View } from './router'

const auth = useAuthStore()
const route = useRoute()
const appVersion = __APP_VERSION__

// route.name is typed `RouteRecordName | undefined` by vue-router; every
// route this app declares (router.ts) names itself with a View, so the cast
// is safe as long as that stays true.
const currentView = computed(() => (route.name as View) ?? 'home')
</script>

<template>
  <main>
    <AuthGate>
      <header class="app-header">
        <div class="brand">
          <img src="/icon-192.png" alt="" class="brand-logo" />
          <h1>RepBunny</h1>
        </div>
        <button type="button" class="icon-button" aria-label="Sign out" @click="auth.signOut()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </button>
      </header>

      <p v-if="currentView === 'home'" class="tagline">Small wins. Stronger every set.</p>

      <section class="content">
        <router-view />
      </section>

      <BottomNav />
    </AuthGate>

    <footer class="app-version">{{ appVersion }}</footer>
  </main>
</template>

<style scoped>
main {
  max-width: 480px;
  margin: 0 auto;
  min-height: 100vh;
  /* Clears the fixed BottomNav (BottomNav.vue) so it never covers the
     footer or the last bit of scrollable content. */
  padding-bottom: calc(84px + env(safe-area-inset-bottom, 0px));
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-logo {
  width: 32px;
  height: 32px;
  border-radius: 8px;
}

.app-header h1 {
  margin: 0;
}

.icon-button {
  width: 44px;
  height: 44px;
  min-height: auto;
  padding: 0;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.tagline {
  margin: 0 16px 16px;
  color: var(--text-dim);
  font-size: 0.85rem;
  font-style: italic;
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
