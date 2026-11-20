<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import type { CollectionItem } from '@/services/collection'
import CardImage from '@/components/common/CardImage.vue'
import PriceTag from '@/components/prices/PriceTag.vue'
import type { PricePoint } from '@/domain/price'
import { CONDITION_LABELS, languageLabel, locationLabel } from './labels'

const props = defineProps<{
  item: CollectionItem
  price?: PricePoint
  /** Affichée dans le « dossier » de sa carte : pas de miniature, la version sert de titre. */
  grouped?: boolean
}>()
const emit = defineEmits<{
  increment: [item: CollectionItem]
  decrement: [item: CollectionItem]
  edit: [item: CollectionItem]
  remove: [item: CollectionItem]
}>()

/** Confirmation de suppression intégrée à la page (plus accessible que `window.confirm`). */
const confirming = ref(false)
const deleteButton = useTemplateRef<HTMLButtonElement>('deleteButton')
const cancelButton = useTemplateRef<HTMLButtonElement>('cancelButton')

// Identifiants uniques pour relier titre et texte de confirmation (aria-labelledby/describedby).
const titleId = `entry-${props.item.id}-title`

/** « TST-FR001 · Common » : ce qui distingue une version des autres exemplaires de la carte. */
const versionLabel = computed(() =>
  [props.item.setCode || 'Code inconnu', props.item.rarity].filter(Boolean).join(' · '),
)
/** Nom donné aux boutons : unique même quand la carte a plusieurs versions. */
const accessibleName = computed(() =>
  props.grouped ? `${props.item.cardName} (${versionLabel.value})` : props.item.cardName,
)
const confirmTextId = `entry-${props.item.id}-confirm`

async function askDelete() {
  confirming.value = true
  // On attend le rendu, puis on place le focus sur « Annuler » : le choix le moins risqué.
  await nextTick()
  cancelButton.value?.focus()
}

async function cancelDelete() {
  confirming.value = false
  await nextTick()
  deleteButton.value?.focus()
}

function decrement() {
  // Passer à 0 supprime l'entrée : on demande donc confirmation, comme pour « Supprimer ».
  if (props.item.quantity <= 1) {
    void askDelete()
  } else {
    emit('decrement', props.item)
  }
}
</script>

<template>
  <li class="entry">
    <article class="entry__card" :aria-labelledby="titleId">
      <CardImage v-if="item.cardKnown && !grouped" :card-id="item.cardId" class="entry__thumb" />
      <div class="entry__body">
        <h4 v-if="grouped" :id="titleId" class="entry__name entry__name--version">
          <span class="visually-hidden">{{ item.cardName }} : </span>{{ versionLabel }}
        </h4>
        <h3 v-else :id="titleId" class="entry__name">{{ item.cardName }}</h3>
        <p class="entry__details">
          <template v-if="!grouped">
            <span class="badge">{{ item.setCode || 'Code inconnu' }}</span>
            <span v-if="item.rarity" class="badge badge--accent">{{ item.rarity }}</span>
          </template>
          <span class="chip">{{ languageLabel(item.language) }}</span>
          <span class="chip">{{ CONDITION_LABELS[item.condition] }}</span>
          <span class="chip">{{ locationLabel(item.location) }}</span>
        </p>
        <p v-if="item.note" class="entry__note">{{ item.note }}</p>
        <PriceTag
          v-if="item.cardKnown && !grouped"
          :card-id="item.cardId"
          :card-name="item.cardName"
          :price="price"
        />
      </div>

      <div class="entry__footer">
        <div class="stepper">
          <button
            type="button"
            class="btn--icon btn--ghost"
            :aria-label="`Retirer un exemplaire de ${accessibleName}`"
            @click="decrement"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path d="M5 12h14" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
            </svg>
          </button>
          <span class="stepper__value"
            ><span class="visually-hidden">Quantité : </span>{{ item.quantity }}</span
          >
          <button
            type="button"
            class="btn--icon btn--ghost"
            :aria-label="`Ajouter un exemplaire de ${accessibleName}`"
            @click="emit('increment', item)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                d="M12 5v14M5 12h14"
                stroke="currentColor"
                stroke-width="2.4"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <div v-if="!confirming" class="entry__actions">
          <button type="button" class="btn--ghost btn--sm" @click="emit('edit', item)">
            Modifier<span class="visually-hidden"> {{ accessibleName }}</span>
          </button>
          <button
            ref="deleteButton"
            type="button"
            class="btn--ghost btn--sm entry__delete"
            @click="askDelete"
          >
            Supprimer<span class="visually-hidden"> {{ accessibleName }}</span>
          </button>
        </div>
      </div>

      <div
        v-if="confirming"
        class="confirm"
        role="group"
        :aria-describedby="confirmTextId"
        @keydown.escape="cancelDelete"
      >
        <p :id="confirmTextId">Supprimer « {{ accessibleName }} » de la collection ?</p>
        <div class="confirm__actions">
          <button type="button" class="btn--danger" @click="emit('remove', item)">
            Oui, supprimer
          </button>
          <button ref="cancelButton" type="button" class="btn--secondary" @click="cancelDelete">
            Annuler
          </button>
        </div>
      </div>
    </article>
  </li>
</template>

<style scoped>
.entry {
  list-style: none;
  min-width: 0;
}

.entry__card {
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'thumb body'
    'footer footer'
    'confirm confirm';
  gap: var(--space-3);
  height: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-base),
    border-color var(--transition-base);
}

.entry__card:hover,
.entry__card:focus-within {
  border-color: color-mix(in srgb, var(--color-primary) 30%, var(--color-border));
  box-shadow: var(--shadow-md);
}

/* Sans miniature (carte inconnue ou images désactivées), le texte prend toute la largeur. */
.entry__card:not(:has(.entry__thumb)) .entry__body {
  grid-column: 1 / -1;
}

.entry__thumb {
  grid-area: thumb;
  width: 4rem;
  height: auto;
  aspect-ratio: 84 / 123;
  object-fit: cover;
  box-shadow: var(--shadow-sm);
}

.entry__body {
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  min-width: 0;
}

.entry__name {
  overflow-wrap: anywhere;
}

.entry__name--version {
  font-family: var(--font-mono);
  font-size: var(--text-md);
}

.entry__details {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.entry__details .chip {
  white-space: normal;
}

.entry__note {
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  font-style: italic;
  overflow-wrap: anywhere;
}

.entry__footer {
  grid-area: footer;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding-top: var(--space-2);
  border-top: 1px solid var(--color-border);
}

.stepper {
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface-2);
}

.stepper button {
  border-radius: var(--radius-pill);
}

.stepper__value {
  min-width: 2.5rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
  text-align: center;
}

/* Signe décoratif : le texte alternatif vide (« / '' ») le cache aux lecteurs d'écran. */
.stepper__value::before {
  content: '×';
  content: '×' / '';
  color: var(--color-text-muted);
  font-weight: 600;
}

.entry__actions {
  display: flex;
  gap: var(--space-1);
}

.entry__delete {
  color: var(--color-danger);
}

.entry__delete:hover {
  background: var(--color-danger-soft);
}

.confirm {
  grid-area: confirm;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
}

.confirm p {
  font-weight: 600;
}

.confirm__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.confirm__actions button {
  flex: 1 1 8rem;
}
</style>
