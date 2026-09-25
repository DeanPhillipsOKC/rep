<script setup lang="ts">
const emit = defineEmits<{ continue: [] }>()
</script>

<template>
  <div class="onboarding">
    <div class="glow glow-pink" aria-hidden="true"></div>
    <div class="glow glow-lavender" aria-hidden="true"></div>

    <div class="content">
      <div class="mascot">
        <img src="/onboarding-bunny.png" alt="" />
      </div>

      <h1 class="wordmark">RepBunny</h1>
      <p class="tagline">Small wins. Stronger every set.</p>

      <button type="button" class="cta" @click="emit('continue')">
        Let's hop in
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
          <path
            d="M9 5l7 7-7 7"
            stroke="currentColor"
            stroke-width="2.4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>

      <div class="dots" aria-hidden="true">
        <span class="dot active"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.onboarding {
  position: relative;
  min-height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: radial-gradient(120% 70% at 50% 8%, #3a2745 0%, var(--bg) 62%);
}

.glow {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.glow-pink {
  left: -60px;
  top: 120px;
  width: 260px;
  height: 260px;
  background: radial-gradient(circle, rgba(242, 135, 156, 0.28) 0%, rgba(242, 135, 156, 0) 70%);
}

.glow-lavender {
  right: -70px;
  top: 280px;
  width: 220px;
  height: 220px;
  background: radial-gradient(circle, rgba(183, 156, 240, 0.22) 0%, rgba(183, 156, 240, 0) 70%);
}

.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: 72px 32px 48px;
  text-align: center;
}

.mascot {
  width: 220px;
  height: 220px;
  flex-shrink: 0;
}

.mascot img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
  filter: drop-shadow(0 18px 32px rgba(0, 0, 0, 0.45));
}

.wordmark {
  font-family: var(--font-display);
  font-weight: 800;
  font-size: 2.4rem;
  color: var(--text);
  margin: 20px 0 0;
  letter-spacing: 0.5px;
}

.tagline {
  font-family: var(--font-body);
  font-weight: 500;
  font-style: italic;
  font-size: 0.95rem;
  color: var(--text-dim);
  margin: 6px 0 0;
}

.cta {
  width: 100%;
  margin-top: 36px;
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
  gap: 8px;
  box-shadow: 0 16px 30px -12px rgba(242, 135, 156, 0.55);
}

.cta:active {
  background: var(--accent-pressed);
}

.dots {
  display: flex;
  gap: 7px;
  margin-top: 32px;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.18);
}

.dot.active {
  width: 22px;
  background: var(--accent);
}
</style>
