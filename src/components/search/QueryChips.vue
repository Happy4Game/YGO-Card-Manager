<script setup lang="ts">
import type { QueryChip } from '@/services/search/queryParser'

/** Ce que la recherche a compris, sous forme de puces retirables, et les avertissements. */
defineProps<{ chips: QueryChip[]; warnings: string[] }>()
const emit = defineEmits<{ remove: [tokenIndex: number] }>()
</script>

<template>
  <div v-if="chips.length > 0 || warnings.length > 0" class="understood">
    <ul v-if="chips.length > 0" class="chips" aria-label="Critères compris">
      <li v-for="chip in chips" :key="`${chip.tokenIndex}-${chip.label}`">
        <span class="chip" :class="{ negate: chip.negate }">
          <span class="label">{{ chip.label }}</span>
          <button type="button" class="remove" @click="emit('remove', chip.tokenIndex)">
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">Retirer le critère {{ chip.label }}</span>
          </button>
        </span>
      </li>
    </ul>
    <ul v-if="warnings.length > 0" class="warnings">
      <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
    </ul>
  </div>
</template>

<style scoped>
.understood {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}
.chips,
.warnings {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.chips li {
  max-width: 100%;
}
.chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  padding-left: var(--space-3);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  font-size: var(--text-sm);
}
.chip.negate {
  border-color: var(--color-danger);
  color: var(--color-danger);
}
.label {
  overflow-wrap: anywhere;
}
.remove {
  display: grid;
  place-items: center;
  flex: none;
  width: 2rem;
  height: 2rem;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: inherit;
  font-size: var(--text-md);
  cursor: pointer;
}
.remove:hover {
  background: var(--color-surface-2);
}
.remove:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: -2px;
}
.warnings li {
  width: 100%;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.warnings li::before {
  content: '⚠ ';
  color: var(--color-accent);
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
