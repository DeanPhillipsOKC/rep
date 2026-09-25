<script setup lang="ts">
// Persistent bottom tab bar (docs/backlog.md item 41), replacing the
// hamburger-drawer nav (AppMenu.vue, item 18). Design source: canvas "Home"
// artboard bottom nav (docs/backlog.md, item 41 mockup link).
</script>

<template>
  <nav class="bottom-nav" aria-label="Primary">
    <div class="bottom-nav-inner">
      <router-link :to="{ name: 'home' }" class="nav-tab" exact-active-class="active">
        <span class="tab-icon">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" stroke-width="1.9" />
            <path
              d="M6 10v9a1 1 0 001 1h3v-5a2 2 0 012-2v0a2 2 0 012 2v5h3a1 1 0 001-1v-9"
              stroke="currentColor"
              stroke-width="1.9"
            />
          </svg>
        </span>
        <span class="tab-label">Home</span>
      </router-link>

      <router-link :to="{ name: 'history' }" class="nav-tab" exact-active-class="active">
        <span class="tab-icon">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8" />
            <path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" />
          </svg>
        </span>
        <span class="tab-label">History</span>
      </router-link>

      <router-link :to="{ name: 'templates' }" class="nav-tab" exact-active-class="active">
        <span class="tab-icon">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <rect x="4" y="7" width="13" height="9" rx="2.5" stroke="currentColor" stroke-width="1.8" />
            <rect x="7.5" y="3.5" width="13" height="9" rx="2.5" stroke="currentColor" stroke-width="1.8" opacity="0.55" />
          </svg>
        </span>
        <span class="tab-label">Templates</span>
      </router-link>

      <router-link :to="{ name: 'exercises' }" class="nav-tab" exact-active-class="active">
        <span class="tab-icon">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
            <rect x="2.5" y="9.5" width="3" height="5" rx="1" fill="currentColor" />
            <rect x="18.5" y="9.5" width="3" height="5" rx="1" fill="currentColor" />
            <rect x="5.5" y="8" width="2.4" height="8" rx="1" fill="currentColor" />
            <rect x="16" y="8" width="2.4" height="8" rx="1" fill="currentColor" />
            <rect x="8" y="11" width="8" height="2" rx="1" fill="currentColor" />
          </svg>
        </span>
        <span class="tab-label">Exercises</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 15;
  background: var(--surface-2);
  border-top: 1px solid var(--border);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.bottom-nav-inner {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  padding: 6px 6px;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px 4px;
  color: var(--text-dim);
  text-decoration: none;
}

.tab-icon {
  width: 46px;
  height: 28px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tab-label {
  font-size: 0.68rem;
  font-weight: 700;
}

.nav-tab.active .tab-icon {
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--accent);
}

.nav-tab.active .tab-label {
  color: var(--accent);
  font-weight: 800;
}
</style>
