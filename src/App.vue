<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppMenu from './components/AppMenu.vue'
import AuthGate from './components/AuthGate.vue'
import { useAuthStore } from './stores/auth'
import type { View } from './router'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const menuOpen = ref(false)
const appVersion = __APP_VERSION__

// route.name is typed `RouteRecordName | undefined` by vue-router; every
// route this app declares (router.ts) names itself with a View, so the cast
// is safe as long as that stays true.
const currentView = computed(() => (route.name as View) ?? 'log')

function navigateTo(view: View) {
  router.push({ name: view })
}
</script>

<template>
  <main>
    <AuthGate>
      <header class="app-header">
        <div class="brand">
          <img src="/icon-192.png" alt="" class="brand-logo" />
          <h1>RepBunny</h1>
        </div>
        <button
          type="button"
          class="menu-button"
          aria-label="Open menu"
          aria-controls="app-menu-drawer"
          :aria-expanded="menuOpen"
          @click="menuOpen = true"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
      </header>

      <p v-if="currentView === 'log'" class="tagline">Small wins. Stronger every set.</p>

      <section class="content">
        <router-view />
      </section>

      <AppMenu
        :open="menuOpen"
        :current-view="currentView"
        @update:open="menuOpen = $event"
        @navigate="navigateTo"
        @sign-out="auth.signOut()"
      />
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

.menu-button {
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
