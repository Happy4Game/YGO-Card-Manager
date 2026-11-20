<script setup lang="ts">
import { nextTick, ref, useTemplateRef } from 'vue'
import type { CollectionItem } from '@/services/collection'
import CardImage from '@/components/common/CardImage.vue'
import { CONDITION_LABELS, languageLabel, locationLabel } from './labels'

const props = defineProps<{ item: CollectionItem }>()
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
    <article :aria-labelledby="titleId">
      <CardImage v-if="item.cardKnown" :card-id="item.cardId" class="thumb" />
      <h3 :id="titleId" class="name">{{ item.cardName }}</h3>
      <p class="details">
        <span>{{ item.setCode || 'Code inconnu' }}</span>
        <span v-if="item.rarity">{{ item.rarity }}</span>
        <span>{{ languageLabel(item.language) }}</span>
        <span>{{ CONDITION_LABELS[item.condition] }}</span>
        <span>{{ locationLabel(item.location) }}</span>
      </p>
      <p v-if="item.note" class="note">{{ item.note }}</p>

      <div class="quantity">
        <button
          type="button"
          class="icon"
          :aria-label="`Retirer un exemplaire de ${item.cardName}`"
          @click="decrement"
        >
          −
        </button>
        <span>Quantité : {{ item.quantity }}</span>
        <button
          type="button"
          class="icon"
          :aria-label="`Ajouter un exemplaire de ${item.cardName}`"
          @click="emit('increment', item)"
        >
          +
        </button>
      </div>

      <div
        v-if="confirming"
        class="confirm"
        role="group"
        :aria-describedby="confirmTextId"
        @keydown.escape="cancelDelete"
      >
        <p :id="confirmTextId">Supprimer « {{ item.cardName }} » de la collection ?</p>
        <button type="button" class="danger" @click="emit('remove', item)">Oui, supprimer</button>
        <button ref="cancelButton" type="button" @click="cancelDelete">Annuler</button>
      </div>
      <div v-else class="actions">
        <button type="button" @click="emit('edit', item)">
          Modifier<span class="visually-hidden"> {{ item.cardName }}</span>
        </button>
        <button ref="deleteButton" type="button" @click="askDelete">
          Supprimer<span class="visually-hidden"> {{ item.cardName }}</span>
        </button>
      </div>
    </article>
  </li>
</template>

<style scoped>
.thumb {
  float: right;
  margin: 0 0 0.5rem 0.75rem;
}
.entry {
  list-style: none;
  border: 1px solid currentColor;
  border-radius: 0.5rem;
  padding: 0.75rem;
}
.name {
  margin: 0;
  font-size: 1.1rem;
  overflow-wrap: anywhere;
}
.details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
  margin: 0.25rem 0;
  font-size: 0.9rem;
}
.note {
  margin: 0.25rem 0;
  font-style: italic;
  overflow-wrap: anywhere;
}
.quantity,
.actions,
.confirm {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.5rem;
}
.confirm p {
  flex-basis: 100%;
  margin: 0;
}
/* Cible tactile d'au moins 44 px (WCAG 2.5.5). */
button {
  min-height: 2.75rem;
}
.icon {
  min-width: 2.75rem;
  font-size: 1.25rem;
}
.danger {
  font-weight: bold;
}
/* Masque visuellement un texte tout en le laissant aux lecteurs d'écran. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
