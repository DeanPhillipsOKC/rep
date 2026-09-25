<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

type View = 'log' | 'exercises' | 'templates' | 'history'

const props = defineProps<{
  open: boolean
  currentView: View
}>()

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void
  (e: 'navigate', view: View): void
  (e: 'sign-out'): void
}>()

const drawerRef = ref<HTMLElement | null>(null)
const closeButtonRef = ref<HTMLButtonElement | null>(null)
let lastFocused: HTMLElement | null = null

function close() {
  emit('update:open', false)
}

function select(view: View) {
  emit('navigate', view)
  close()
}

function signOut() {
  emit('sign-out')
  close()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Tab' || !drawerRef.value) return

  const focusable = drawerRef.value.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (isOpen) => {
    if (isOpen) {
      lastFocused = document.activeElement as HTMLElement | null
      document.addEventListener('keydown', onKeydown)
      await nextTick()
      closeButtonRef.value?.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      lastFocused?.focus()
      lastFocused = null
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="menu-overlay">
      <div class="scrim" @click="close"></div>

      <div id="app-menu-drawer" ref="drawerRef" class="drawer" role="dialog" aria-modal="true" aria-label="Menu">
        <div class="drawer-header">
          <div class="brand">
            <img src="/icon-192.png" alt="" class="brand-logo" />
            <span>RepBunny</span>
          </div>
          <button
            ref="closeButtonRef"
            type="button"
            class="icon-button"
            aria-label="Close menu"
            @click="close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav class="nav-list">
          <button
            type="button"
            class="nav-item"
            :class="{ active: currentView === 'log' }"
            :aria-current="currentView === 'log' ? 'page' : undefined"
            @click="select('log')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="16" />
              <line x1="8" y1="12" x2="16" y2="12" />
            </svg>
            Log
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: currentView === 'exercises' }"
            :aria-current="currentView === 'exercises' ? 'page' : undefined"
            @click="select('exercises')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="6" y1="12" x2="18" y2="12" />
              <rect x="2" y="9" width="4" height="6" rx="1" />
              <rect x="18" y="9" width="4" height="6" rx="1" />
              <rect x="5" y="7" width="2" height="10" rx="1" />
              <rect x="17" y="7" width="2" height="10" rx="1" />
            </svg>
            Exercises
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: currentView === 'templates' }"
            :aria-current="currentView === 'templates' ? 'page' : undefined"
            @click="select('templates')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Templates
          </button>

          <button
            type="button"
            class="nav-item"
            :class="{ active: currentView === 'history' }"
            :aria-current="currentView === 'history' ? 'page' : undefined"
            @click="select('history')"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            History
          </button>
        </nav>

        <div class="spacer"></div>

        <div class="drawer-footer">
          <button type="button" class="nav-item sign-out" @click="signOut">
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 20;
}

.scrim {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
}

.drawer {
  position: absolute;
  top: 0;
  right: 0;
  width: min(296px, 84%);
  height: 100%;
  height: 100dvh;
  box-sizing: border-box;
  background: var(--surface-2);
  border-left: 1px solid var(--border);
  box-shadow: -12px 0 32px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
}

.brand-logo {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: block;
}

.icon-button {
  width: 36px;
  height: 36px;
  min-height: auto;
  padding: 0;
  border-radius: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 10px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 15px;
  min-height: 44px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 12px;
  color: var(--text-dim);
  font-weight: 600;
  font-size: 0.92rem;
  text-align: left;
}

.nav-item.active {
  background: var(--surface);
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  color: var(--text);
  font-weight: 700;
}

.nav-item.active svg {
  stroke: var(--accent);
}

.spacer {
  flex: 1;
}

.drawer-footer {
  border-top: 1px solid var(--border);
  padding: 10px;
}

.sign-out svg {
  stroke: var(--danger);
}
</style>
