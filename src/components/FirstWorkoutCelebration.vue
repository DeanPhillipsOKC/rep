<script setup lang="ts">
import { pickCelebration } from '../lib/celebration'

// Item 70: shown in VolumeChart's slot the first time a given template is
// ever completed, when there's only a single volumeHistory point and a
// line chart would just be a dot. Reuses the same mascot pool
// RecordCelebration.vue draws from, picked fresh each time this mounts.
const variant = pickCelebration()
</script>

<template>
  <div class="first-workout">
    <img class="first-workout-mascot" :src="variant.image" alt="" />
    <h3 class="first-workout-headline">First workout logged. {{ variant.phrase }}</h3>
    <p class="first-workout-sub">Track your volume over time as you complete more workouts.</p>
  </div>
</template>

<style scoped>
.first-workout {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 8px;
  padding: 4px 0 12px;
}

.first-workout-mascot {
  width: 96px;
  height: 96px;
  object-fit: contain;
  filter: drop-shadow(0 6px 16px rgba(0, 0, 0, 0.35));
}

.first-workout-headline {
  margin: 0;
  font-size: 1.05rem;
}

.first-workout-sub {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-dim);
}
</style>
