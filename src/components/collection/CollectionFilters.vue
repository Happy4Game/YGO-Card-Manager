<script setup lang="ts">
import { CARD_CONDITIONS, type CardCondition } from '@/domain/collection'
import type { CollectionSortKey, SortDirection } from '@/services/collection'
import { CONDITION_LABELS } from './labels'

defineProps<{ locations: string[] }>()

// `defineModel` crée une prop + un événement `update:…` pour chaque v-model.
// Doc : https://vuejs.org/guide/components/v-model.html
const text = defineModel<string>('text', { required: true })
const location = defineModel<string>('location', { required: true })
const condition = defineModel<CardCondition | ''>('condition', { required: true })
const sortKey = defineModel<CollectionSortKey>('sortKey', { required: true })
const sortDirection = defineModel<SortDirection>('sortDirection', { required: true })

const emit = defineEmits<{ reset: [] }>()
</script>

<template>
  <!-- role="search" signale une zone de recherche aux lecteurs d'écran. -->
  <form class="filters surface" role="search" aria-label="Filtrer la collection" @submit.prevent>
    <div class="field filters__text">
      <label for="filter-text">Nom ou code</label>
      <input
        id="filter-text"
        v-model="text"
        type="search"
        autocomplete="off"
        enterkeyhint="search"
        placeholder="ex. dragon, ABC-FR001"
      />
    </div>
    <div class="field">
      <label for="filter-location">Emplacement</label>
      <select id="filter-location" v-model="location">
        <option value="">Tous</option>
        <option v-for="item in locations" :key="item" :value="item">{{ item }}</option>
      </select>
    </div>
    <div class="field">
      <label for="filter-condition">État</label>
      <select id="filter-condition" v-model="condition">
        <option value="">Tous</option>
        <option v-for="item in CARD_CONDITIONS" :key="item" :value="item">
          {{ CONDITION_LABELS[item] }}
        </option>
      </select>
    </div>
    <div class="field">
      <label for="sort-key">Trier par</label>
      <select id="sort-key" v-model="sortKey">
        <option value="addedAt">Date d'ajout</option>
        <option value="name">Nom</option>
        <option value="quantity">Quantité</option>
      </select>
    </div>
    <div class="field">
      <label for="sort-direction">Ordre</label>
      <select id="sort-direction" v-model="sortDirection">
        <option value="asc">Croissant</option>
        <option value="desc">Décroissant</option>
      </select>
    </div>
    <button type="button" class="btn--ghost filters__reset" @click="emit('reset')">
      Réinitialiser les filtres
    </button>
  </form>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
  align-items: end;
}

.filters__text,
.filters__reset {
  grid-column: 1 / -1;
}

@media (min-width: 48rem) {
  .filters {
    grid-template-columns: 2fr repeat(4, minmax(0, 1fr));
  }

  .filters__text {
    grid-column: auto;
  }

  .filters__reset {
    grid-column: 1 / -1;
    justify-self: end;
    margin-top: calc(-1 * var(--space-2));
  }
}
</style>
