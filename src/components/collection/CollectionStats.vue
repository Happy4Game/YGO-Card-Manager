<script setup lang="ts">
import type { CollectionStats } from '@/services/collection'
import { locationLabel, setLabel } from './labels'

defineProps<{ stats: CollectionStats }>()
</script>

<template>
  <section class="stats" aria-labelledby="stats-title">
    <h2 id="stats-title" class="visually-hidden">Résumé</h2>
    <dl class="totals">
      <div class="total surface">
        <dt>Exemplaires</dt>
        <dd>{{ stats.totalCopies }}</dd>
      </div>
      <div class="total surface">
        <dt>Cartes différentes</dt>
        <dd>{{ stats.distinctCards }}</dd>
      </div>
    </dl>

    <!-- <details> : section repliable native, accessible au clavier sans JavaScript.
         Doc : https://developer.mozilla.org/fr/docs/Web/HTML/Element/details -->
    <div class="breakdown">
      <details class="surface">
        <summary>Par emplacement</summary>
        <ul>
          <li v-for="row in stats.byLocation" :key="row.label">
            <span>{{ locationLabel(row.label) }}</span>
            <span class="copies">{{ row.copies }}</span>
          </li>
        </ul>
      </details>
      <details class="surface">
        <summary>Par extension</summary>
        <ul>
          <li v-for="row in stats.bySet" :key="row.label">
            <span>{{ setLabel(row.label) }}</span>
            <span class="copies">{{ row.copies }}</span>
          </li>
        </ul>
      </details>
    </div>
  </section>
</template>

<style scoped>
.stats {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.totals {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.total {
  display: flex;
  flex-direction: column-reverse;
  gap: var(--space-1);
  padding: var(--space-4);
}

.total dt {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-weight: 600;
}

.total dd {
  margin: 0;
  color: var(--color-primary);
  font-size: 2rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.breakdown {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-3);
  align-items: start;
}

details {
  padding: 0;
}

summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: var(--tap-target);
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-weight: 650;
  cursor: pointer;
  list-style: none;
}

summary::-webkit-details-marker {
  display: none;
}

/* Chevron dessiné en CSS, tourné quand la section est ouverte. */
summary::after {
  content: '';
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg);
  transition: transform var(--transition-base);
}

details[open] summary::after {
  transform: rotate(-135deg);
}

ul {
  margin: 0;
  padding: 0 var(--space-4) var(--space-3);
  list-style: none;
}

li {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.copies {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
</style>
