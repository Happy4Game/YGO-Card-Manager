<script setup lang="ts">
import { computed } from 'vue'
import CardImage from '@/components/common/CardImage.vue'
import PriceTag from '@/components/prices/PriceTag.vue'
import type { PricePoint } from '@/domain/price'
import type { CollectionGroup, CollectionItem } from '@/services/collection'
import CollectionEntryItem from './CollectionEntryItem.vue'

/**
 * Une carte de la collection, comme un « dossier » : l'en-tête résume toutes les versions
 * possédées (exemplaires, raretés) ; un appui l'ouvre et liste chaque version, modifiable
 * séparément. Bouton + aria-expanded : motif « disclosure » des WAI-ARIA Authoring Practices.
 * Doc : https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/
 */
const props = defineProps<{ group: CollectionGroup; price?: PricePoint; open: boolean }>()
const emit = defineEmits<{
  toggle: []
  addVersion: [cardId: number]
  increment: [item: CollectionItem]
  decrement: [item: CollectionItem]
  edit: [item: CollectionItem]
  remove: [item: CollectionItem]
}>()

const panelId = computed(() => `group-${props.group.cardId}-versions`)
const titleId = computed(() => `group-${props.group.cardId}-title`)
const summary = computed(() => {
  const { totalCopies, items } = props.group
  const copies = `${String(totalCopies)} exemplaire${totalCopies > 1 ? 's' : ''}`
  const versions = `${String(items.length)} version${items.length > 1 ? 's' : ''}`
  return `${copies} · ${versions}`
})
</script>

<template>
  <li class="group" :class="{ 'group--open': open }">
    <section class="group__card" :aria-labelledby="titleId">
      <div class="group__head">
        <CardImage v-if="group.cardKnown" :card-id="group.cardId" class="group__thumb" />
        <div class="group__body">
          <h3 :id="titleId" class="group__name">
            <button
              type="button"
              class="group__toggle"
              :aria-expanded="open"
              :aria-controls="panelId"
              @click="emit('toggle')"
            >
              <span>{{ group.cardName }}</span>
              <svg
                class="group__chevron"
                viewBox="0 0 24 24"
                width="20"
                height="20"
                aria-hidden="true"
              >
                <path
                  d="m9 6 6 6-6 6"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </h3>
          <p class="group__summary">{{ summary }}</p>
          <p v-if="group.rarities.length > 0" class="group__rarities">
            <span v-for="rarity in group.rarities" :key="rarity" class="badge badge--accent">
              {{ rarity }}
            </span>
          </p>
          <PriceTag
            v-if="group.cardKnown"
            :card-id="group.cardId"
            :card-name="group.cardName"
            :price="price"
          />
        </div>
      </div>

      <div v-if="open" :id="panelId" class="group__versions">
        <ul class="group__list">
          <CollectionEntryItem
            v-for="item in group.items"
            :key="item.id"
            :item="item"
            grouped
            @increment="emit('increment', $event)"
            @decrement="emit('decrement', $event)"
            @edit="emit('edit', $event)"
            @remove="emit('remove', $event)"
          />
        </ul>
        <button type="button" class="btn--secondary" @click="emit('addVersion', group.cardId)">
          Ajouter une version<span class="visually-hidden"> de {{ group.cardName }}</span>
        </button>
      </div>
    </section>
  </li>
</template>

<style scoped>
.group {
  list-style: none;
  min-width: 0;
}

.group__card {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}

.group--open .group__card {
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  box-shadow: var(--shadow-md);
}

.group__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--space-3);
}

.group__head:not(:has(.group__thumb)) .group__body {
  grid-column: 1 / -1;
}

.group__thumb {
  width: 4rem;
  height: auto;
  aspect-ratio: 84 / 123;
  object-fit: cover;
  box-shadow: var(--shadow-sm);
}

.group__body {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.group__name {
  margin: 0;
  font-size: var(--text-md);
}

/* Tout le titre est la zone tactile (au moins 44 px de haut, WCAG 2.5.8). */
.group__toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  width: 100%;
  min-height: 2.75rem;
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.group__toggle:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.group__chevron {
  flex: none;
  color: var(--color-primary);
  transition: transform var(--transition-fast);
}

.group--open .group__chevron {
  transform: rotate(90deg);
}

.group__summary {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.group__rarities {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.group__versions {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.group__list {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
}

@media (prefers-reduced-motion: reduce) {
  .group__chevron {
    transition: none;
  }
}
</style>
