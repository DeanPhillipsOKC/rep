<script setup lang="ts">
import { computed } from 'vue'
import type { VolumeChartPoint } from '../lib/volume'

const props = defineProps<{ points: VolumeChartPoint[] }>()

const width = 320
const height = 160
const padding = 8

// Both lines share one scale so they stay comparable point-for-point;
// zero is always included so a short bar of workouts doesn't look like a
// huge swing.
const maxVolume = computed(() => Math.max(0, ...props.points.flatMap((p) => [p.actual, p.projected])))

function x(index: number): number {
  if (props.points.length <= 1) return width / 2
  return padding + (index / (props.points.length - 1)) * (width - padding * 2)
}

function y(value: number): number {
  if (maxVolume.value === 0) return height - padding
  return height - padding - (value / maxVolume.value) * (height - padding * 2)
}

function pathFor(key: 'actual' | 'projected'): string {
  return props.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[key])}`).join(' ')
}

const actualPath = computed(() => pathFor('actual'))
const projectedPath = computed(() => pathFor('projected'))

// All points share one scale (see maxVolume above), so one unit label is
// enough — take it from the most recent point rather than the first, since
// that's the one most likely to reflect how the user logs today.
const unit = computed(() => props.points[props.points.length - 1]?.weightUnit ?? 'lb')

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="volume-chart">
    <div class="legend">
      <span class="legend-item"><span class="swatch actual" /> Actual</span>
      <span class="legend-item"><span class="swatch projected" /> Projected</span>
    </div>
    <p v-if="points.length > 0" class="explainer">
      Projected volume ({{ unit }}) carries forward your last complete total for any exercise you
      skipped or fell short of its target sets on that day, so a lighter day doesn't read as a
      bigger drop than it was.
    </p>

    <div v-if="points.length > 0" class="chart-area">
      <div class="axis-labels" aria-hidden="true">
        <span>{{ Math.round(maxVolume) }} {{ unit }}</span>
        <span>0</span>
      </div>
      <svg
        :viewBox="`0 0 ${width} ${height}`"
        class="chart-svg"
        preserveAspectRatio="none"
        role="img"
        :aria-label="`Volume over time, in ${unit}`"
      >
        <path :d="projectedPath" class="line projected" />
        <path :d="actualPath" class="line actual" />
        <circle v-for="(p, i) in points" :key="i" :cx="x(i)" :cy="y(p.actual)" r="3" class="dot actual" />
      </svg>
    </div>
    <p v-else class="empty">Not enough history yet.</p>

    <div v-if="points.length > 0" class="range">
      <span>{{ formatDate(points[0].performedAt) }}</span>
      <span v-if="points.length > 1">{{ formatDate(points[points.length - 1].performedAt) }}</span>
    </div>

    <ul v-if="points.length > 0" class="points-list">
      <li v-for="(p, i) in points" :key="i" class="point-row" data-testid="volume-point">
        <span class="row-sub">{{ formatDate(p.performedAt) }}</span>
        <span>{{ Math.round(p.actual) }} actual<template v-if="p.projected !== p.actual"> · {{ Math.round(p.projected) }} projected</template></span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.volume-chart {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend {
  display: flex;
  gap: 16px;
  font-size: 0.8rem;
  color: var(--text-dim);
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.swatch {
  display: inline-block;
  width: 14px;
  height: 3px;
  border-radius: 2px;
}

.swatch.actual {
  background: var(--accent);
}

.swatch.projected {
  background: var(--text-dim);
}

.explainer {
  font-size: 0.75rem;
  color: var(--text-dim);
  margin: 0;
}

.chart-area {
  display: flex;
  align-items: stretch;
  gap: 6px;
}

.axis-labels {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  font-size: 0.7rem;
  color: var(--text-dim);
  white-space: nowrap;
  padding: 2px 0;
}

.chart-svg {
  width: 100%;
  height: 160px;
  display: block;
  flex: 1;
}

.line {
  fill: none;
  stroke-width: 2;
}

.line.actual {
  stroke: var(--accent);
}

.line.projected {
  stroke: var(--text-dim);
  stroke-dasharray: 5 4;
}

.dot.actual {
  fill: var(--accent);
}

.range {
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  color: var(--text-dim);
}

.empty {
  text-align: center;
  padding: 16px 0;
}

.points-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 4px;
  font-size: 0.8rem;
}

.point-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
</style>
