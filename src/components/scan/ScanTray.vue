<script setup lang="ts">
import { computed } from 'vue'
import { setCodeKey } from '@/domain/setCode'
import { routes } from '@/lib/routes'
import type { DetectedCard } from './types'

/**
 * « Cartes détectées » : tout ce que le scan a reconnu, à vérifier puis ajouter d'un coup.
 * Chaque ligne garde son code et propose les raretés connues pour ce code.
 */
const props = defineProps<{ items: DetectedCard[]; busy: boolean }>()
const emit = defineEmits<{
  add: []
  remove: [key: string]
  clear: []
  update: [key: string, changes: Partial<DetectedCard>]
}>()

const addable = computed(() =>
  props.items.filter((item) => item.selected && item.cardId !== undefined),
)

function cardOf(item: DetectedCard) {
  return item.cards.find((card) => card.id === item.cardId)
}

/** Raretés de l'impression lue (même code, toutes langues) pour la carte choisie. */
function raritiesOf(item: DetectedCard): string[] {
  const key = setCodeKey(item.code)
  const sets = cardOf(item)?.sets.filter((set) => setCodeKey(set.code) === key) ?? []
  const list = [...new Set(sets.map((set) => set.rarity).filter(Boolean))]
  if (item.rarity && !list.includes(item.rarity)) list.unshift(item.rarity)
  return list
}

function onCardChange(item: DetectedCard, event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  emit('update', item.key, { cardId: value, rarity: '' })
}
</script>

<template>
  <section class="tray" aria-labelledby="tray-title">
    <div class="tray__head">
      <h2 id="tray-title" class="tray__title">
        Cartes détectées <span class="tray__count">({{ items.length }})</span>
      </h2>
      <button type="button" class="btn--ghost btn--sm" @click="emit('clear')">Tout effacer</button>
    </div>

    <ul class="tray__list">
      <li
        v-for="item in items"
        :key="item.key"
        class="tray__item"
        :class="{ 'tray__item--unknown': item.cards.length === 0 }"
      >
        <input
          :id="`tray-${item.key}`"
          type="checkbox"
          class="tray__check"
          :checked="item.selected"
          :disabled="item.cardId === undefined"
          @change="emit('update', item.key, { selected: !item.selected })"
        />
        <div class="tray__body">
          <label :for="`tray-${item.key}`" class="tray__name">
            {{ cardOf(item)?.name ?? 'Carte inconnue' }}
            <span class="tray__code">{{ item.code }}</span>
          </label>
          <p v-if="item.cards.length === 0" class="tray__hint">
            Code lu, mais aucune carte connue ne le porte. Vérifie-le ou retire la ligne.
          </p>
          <div v-else class="tray__fields">
            <select
              v-if="item.cards.length > 1"
              :aria-label="`Carte pour le code ${item.code}`"
              :value="item.cardId"
              @change="onCardChange(item, $event)"
            >
              <option v-for="card in item.cards" :key="card.id" :value="card.id">
                {{ card.name }}
              </option>
            </select>
            <select
              :aria-label="`Rareté de ${cardOf(item)?.name ?? item.code}`"
              :value="item.rarity"
              @change="
                emit('update', item.key, { rarity: ($event.target as HTMLSelectElement).value })
              "
            >
              <option value="">Rareté non précisée</option>
              <option v-for="rarity in raritiesOf(item)" :key="rarity" :value="rarity">
                {{ rarity }}
              </option>
            </select>
            <a
              v-if="item.cardId !== undefined"
              class="tray__details"
              :href="routes.collectionAdd(item.cardId, item.code)"
            >
              Détails<span class="visually-hidden"> de l'ajout pour {{ cardOf(item)?.name }}</span>
            </a>
          </div>
        </div>
        <button
          type="button"
          class="tray__remove"
          :aria-label="`Retirer ${cardOf(item)?.name ?? item.code} de la liste`"
          @click="emit('remove', item.key)"
        >
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" stroke-width="2.2" />
          </svg>
        </button>
      </li>
    </ul>

    <button
      type="button"
      class="btn--primary tray__add"
      :disabled="busy || addable.length === 0"
      @click="emit('add')"
    >
      Ajouter {{ addable.length }} carte{{ addable.length > 1 ? 's' : '' }} à ma collection
    </button>
  </section>
</template>

<style scoped>
.tray {
  display: grid;
  gap: var(--space-3);
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}
.tray__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.tray__title {
  margin: 0;
  font-size: var(--text-lg);
}
.tray__details {
  font-size: var(--text-sm);
  font-weight: 600;
}
.tray__count {
  color: var(--color-text-muted);
  font-weight: 600;
}
.tray__list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.tray__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--space-2);
  padding: var(--space-2);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
}
.tray__item--unknown {
  opacity: 0.8;
}
.tray__check {
  width: 1.4rem;
  height: 1.4rem;
  margin: 0.55rem 0.3rem 0;
  accent-color: var(--color-primary);
}
.tray__body {
  display: grid;
  gap: var(--space-1);
  min-width: 0;
}
.tray__name {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0 var(--space-2);
  min-height: 2.75rem;
  padding-top: 0.55rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.tray__code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text-muted);
}
.tray__hint {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.tray__fields {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2);
}
.tray__fields select {
  min-height: 2.75rem;
  max-width: 100%;
}
.tray__remove {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  border: none;
  border-radius: var(--radius-pill);
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
}
.tray__remove:hover {
  background: var(--color-surface);
}
.tray__remove:focus-visible,
.tray__check:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.tray__add {
  width: 100%;
}
</style>
