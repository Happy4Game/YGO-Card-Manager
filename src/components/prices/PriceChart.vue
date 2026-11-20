<script setup lang="ts">
import { computed } from 'vue'
import type { PricePoint } from '@/domain/price'
import { formatEuros } from '@/services/priceTracker'

/**
 * Courbe des prix dessinée en SVG, sans bibliothèque. Le tableau qui suit le graphique donne
 * les mêmes valeurs en texte (accessibilité : https://www.w3.org/WAI/tutorials/images/complex/).
 */
const props = defineProps<{ points: PricePoint[] }>()

const WIDTH = 320
const HEIGHT = 160
const PAD = { top: 12, right: 12, bottom: 24, left: 44 }

const values = computed(() =>
  props.points.filter((p): p is PricePoint & { cardmarket: number } => p.cardmarket !== null),
)

const scale = computed(() => {
  const prices = values.value.map((p) => p.cardmarket)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const span = max - min || max || 1
  return { min: Math.max(0, min - span * 0.1), max: max + span * 0.1 }
})

function x(index: number): number {
  const count = values.value.length
  const inner = WIDTH - PAD.left - PAD.right
  return count <= 1 ? PAD.left + inner / 2 : PAD.left + (index / (count - 1)) * inner
}

function y(value: number): number {
  const { min, max } = scale.value
  const inner = HEIGHT - PAD.top - PAD.bottom
  return PAD.top + inner - ((value - min) / (max - min || 1)) * inner
}

const path = computed(() =>
  values.value
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.cardmarket).toFixed(1)}`)
    .join(' '),
)

const ticks = computed(() => {
  const { min, max } = scale.value
  return [min, (min + max) / 2, max]
})

function shortDate(date: string): string {
  const [, month, day] = date.split('-')
  return `${day ?? ''}/${month ?? ''}`
}
</script>

<template>
  <figure class="chart">
    <svg
      v-if="values.length > 0"
      :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
      role="img"
      aria-label="Évolution du prix Cardmarket, détail dans le tableau ci-dessous"
    >
      <g class="chart__grid">
        <template v-for="tick in ticks" :key="tick">
          <line :x1="PAD.left" :x2="WIDTH - PAD.right" :y1="y(tick)" :y2="y(tick)" />
          <text :x="PAD.left - 6" :y="y(tick) + 4" text-anchor="end">
            {{ formatEuros(tick) }}
          </text>
        </template>
      </g>
      <path class="chart__line" :d="path" />
      <circle
        v-for="(point, index) in values"
        :key="point.date"
        class="chart__dot"
        :cx="x(index)"
        :cy="y(point.cardmarket)"
        r="3.5"
      />
      <text class="chart__label" :x="x(0)" :y="HEIGHT - 6" text-anchor="start">
        {{ shortDate(values[0]?.date ?? '') }}
      </text>
      <text
        v-if="values.length > 1"
        class="chart__label"
        :x="x(values.length - 1)"
        :y="HEIGHT - 6"
        text-anchor="end"
      >
        {{ shortDate(values[values.length - 1]?.date ?? '') }}
      </text>
    </svg>
    <figcaption class="visually-hidden">Relevés de prix Cardmarket</figcaption>
    <table class="chart__table">
      <thead>
        <tr>
          <th scope="col">Date</th>
          <th scope="col">Prix Cardmarket</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="point in [...points].reverse()" :key="point.date">
          <td>{{ new Date(`${point.date}T12:00:00`).toLocaleDateString('fr-FR') }}</td>
          <td>
            {{ point.cardmarket === null ? 'Non disponible' : formatEuros(point.cardmarket) }}
          </td>
        </tr>
      </tbody>
    </table>
  </figure>
</template>

<style scoped>
.chart {
  margin: 0;
}
svg {
  width: 100%;
  height: auto;
  display: block;
}
.chart__grid line {
  stroke: var(--color-border);
  stroke-width: 1;
}
.chart__grid text,
.chart__label {
  fill: var(--color-text-muted);
  font-size: 10px;
}
.chart__line {
  fill: none;
  stroke: var(--color-primary);
  stroke-width: 2.5;
  stroke-linejoin: round;
  stroke-linecap: round;
}
.chart__dot {
  fill: var(--color-surface);
  stroke: var(--color-primary);
  stroke-width: 2;
}
.chart__table {
  width: 100%;
  margin-top: var(--space-3);
  border-collapse: collapse;
  font-size: var(--text-sm);
}
.chart__table th,
.chart__table td {
  text-align: left;
  padding: var(--space-1) var(--space-2);
  border-bottom: 1px solid var(--color-border);
}
.chart__table td:last-child,
.chart__table th:last-child {
  text-align: right;
}
</style>
