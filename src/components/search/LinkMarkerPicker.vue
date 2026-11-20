<script setup lang="ts">
import { LINK_MARKERS } from '@/services/search/vocabulary'

/**
 * Flèches Lien : 8 boutons bascule disposés en grille 3×3 autour du centre de la carte.
 * `aria-pressed` indique l'état de chaque bouton aux lecteurs d'écran.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Attributes/aria-pressed
 */
const props = defineProps<{ modelValue: string[] }>()
const emit = defineEmits<{ 'update:modelValue': [markers: string[]] }>()

const ARROWS: Readonly<Record<string, string>> = {
  'Top-Left': '↖',
  Top: '↑',
  'Top-Right': '↗',
  Left: '←',
  Right: '→',
  'Bottom-Left': '↙',
  Bottom: '↓',
  'Bottom-Right': '↘',
}

function toggle(value: string): void {
  const next = props.modelValue.includes(value)
    ? props.modelValue.filter((marker) => marker !== value)
    : [...props.modelValue, value]
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="marker-grid">
    <template v-for="(marker, index) in LINK_MARKERS" :key="marker.value">
      <span v-if="index === 4" class="center" aria-hidden="true"></span>
      <button
        type="button"
        class="marker"
        :aria-pressed="modelValue.includes(marker.value)"
        :title="marker.label"
        @click="toggle(marker.value)"
      >
        <span aria-hidden="true">{{ ARROWS[marker.value] }}</span>
        <span class="visually-hidden">{{ marker.label }}</span>
      </button>
    </template>
  </div>
</template>

<style scoped>
.marker-grid {
  display: grid;
  grid-template-columns: repeat(3, 2.75rem);
  grid-template-rows: repeat(3, 2.75rem);
  gap: var(--space-1);
  width: fit-content;
}
.center {
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}
.marker {
  display: grid;
  place-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: var(--text-lg);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}
.marker[aria-pressed='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.marker:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
