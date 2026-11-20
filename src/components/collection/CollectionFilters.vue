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
  <form class="filters" role="search" aria-label="Filtrer la collection" @submit.prevent>
    <div class="field">
      <label for="filter-text">Nom ou code</label>
      <input id="filter-text" v-model="text" type="search" autocomplete="off" />
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
    <button type="button" @click="emit('reset')">Réinitialiser les filtres</button>
  </form>
</template>

<style scoped>
.filters {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
  gap: 0.5rem 1rem;
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
}
.field input,
.field select {
  min-width: 0;
}
</style>
