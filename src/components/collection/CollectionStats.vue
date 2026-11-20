<script setup lang="ts">
import type { CollectionStats } from '@/services/collection'
import { locationLabel, setLabel } from './labels'

defineProps<{ stats: CollectionStats }>()
</script>

<template>
  <section class="stats" aria-labelledby="stats-title">
    <h2 id="stats-title">Résumé</h2>
    <dl class="totals">
      <div>
        <dt>Exemplaires</dt>
        <dd>{{ stats.totalCopies }}</dd>
      </div>
      <div>
        <dt>Cartes différentes</dt>
        <dd>{{ stats.distinctCards }}</dd>
      </div>
    </dl>

    <!-- <details> : section repliable native, accessible au clavier sans JavaScript.
         Doc : https://developer.mozilla.org/fr/docs/Web/HTML/Element/details -->
    <details>
      <summary>Par emplacement</summary>
      <ul>
        <li v-for="row in stats.byLocation" :key="row.label">
          {{ locationLabel(row.label) }} : {{ row.copies }}
        </li>
      </ul>
    </details>
    <details>
      <summary>Par extension</summary>
      <ul>
        <li v-for="row in stats.bySet" :key="row.label">
          {{ setLabel(row.label) }} : {{ row.copies }}
        </li>
      </ul>
    </details>
  </section>
</template>

<style scoped>
.totals {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0 0 0.5rem;
}
.totals div {
  min-width: 8rem;
}
.totals dt {
  font-size: 0.875rem;
}
.totals dd {
  margin: 0;
  font-size: 1.5rem;
  font-weight: bold;
}
summary {
  cursor: pointer;
}
</style>
