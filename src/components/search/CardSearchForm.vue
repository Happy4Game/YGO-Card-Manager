<script setup lang="ts">
import { reactive } from 'vue'
import type { CardFilterOptions, CardSearchFilters } from '@/services/cardSearch'

defineProps<{
  options: CardFilterOptions
  disabled?: boolean
}>()

const emit = defineEmits<{
  search: [filters: CardSearchFilters]
}>()

const filters = reactive({ name: '', type: '', attribute: '', race: '' })

function submit(): void {
  // On émet une copie pour que la recherche lancée ne change pas pendant la saisie suivante.
  emit('search', { ...filters })
}

function reset(): void {
  Object.assign(filters, { name: '', type: '', attribute: '', race: '' })
  submit()
}
</script>

<template>
  <form class="search-form" role="search" @submit.prevent="submit">
    <div class="field">
      <label for="search-name">Nom de la carte</label>
      <input id="search-name" v-model="filters.name" type="search" autocomplete="off" />
    </div>

    <div class="field">
      <label for="search-type">Type</label>
      <select id="search-type" v-model="filters.type">
        <option value="">Tous</option>
        <option v-for="type in options.types" :key="type" :value="type">{{ type }}</option>
      </select>
    </div>

    <div class="field">
      <label for="search-attribute">Attribut</label>
      <select id="search-attribute" v-model="filters.attribute">
        <option value="">Tous</option>
        <option v-for="attribute in options.attributes" :key="attribute" :value="attribute">
          {{ attribute }}
        </option>
      </select>
    </div>

    <div class="field">
      <label for="search-race">Race / sous-type</label>
      <select id="search-race" v-model="filters.race">
        <option value="">Toutes</option>
        <option v-for="race in options.races" :key="race" :value="race">{{ race }}</option>
      </select>
    </div>

    <div class="actions">
      <button type="submit" :disabled="disabled">Rechercher</button>
      <button type="button" :disabled="disabled" @click="reset">Réinitialiser</button>
    </div>
  </form>
</template>

<style scoped>
.search-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  gap: 0.75rem 1rem;
  align-items: end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.actions {
  display: flex;
  gap: 0.5rem;
}
input:focus-visible,
select:focus-visible,
button:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
</style>
