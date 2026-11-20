<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { db } from '@/db/database'
import type { PricePoint } from '@/domain/price'
import { cardmarketSearchUrl, formatEuros, getPriceHistory } from '@/services/priceTracker'
import PriceChart from './PriceChart.vue'

/**
 * Prix Cardmarket d'une carte possédée. Un clic ouvre l'historique enregistré sur l'appareil
 * dans une boîte de dialogue native <dialog> (focus et touche Échap gérés par le navigateur).
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/HTML/Element/dialog
 */
const props = defineProps<{ cardId: number; cardName: string; price?: PricePoint }>()

const dialog = useTemplateRef<HTMLDialogElement>('dialog')
const history = ref<PricePoint[]>([])

async function open() {
  history.value = await getPriceHistory(db, props.cardId)
  dialog.value?.showModal()
}

function close() {
  dialog.value?.close()
}
</script>

<template>
  <button type="button" class="price" @click="open">
    <span class="visually-hidden">Prix Cardmarket de {{ cardName }} : </span>
    <template v-if="price?.cardmarket != null"> dès {{ formatEuros(price.cardmarket) }} </template>
    <template v-else>Prix ?</template>
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="M4 18l5-6 4 3 7-9"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  </button>

  <dialog ref="dialog" class="price-dialog" :aria-label="`Historique du prix de ${cardName}`">
    <header class="price-dialog__header">
      <h2>{{ cardName }}</h2>
      <button type="button" class="btn--ghost btn--icon" aria-label="Fermer" @click="close">
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path
            d="M6 6l12 12M18 6L6 18"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </header>
    <p v-if="history.length === 0" class="muted">
      Aucun prix enregistré pour l'instant. Les prix de ta collection sont relevés une fois par jour
      quand tu ouvres l'app.
    </p>
    <PriceChart v-else :points="history" />
    <p class="price-dialog__note">
      Prix le plus bas toutes impressions confondues, fourni par YGOPRODeck et relevé sur cet
      appareil depuis que la carte est dans ta collection.
    </p>
    <a
      class="btn btn--secondary"
      :href="cardmarketSearchUrl(cardName)"
      target="_blank"
      rel="noopener noreferrer"
    >
      Voir l'historique complet sur Cardmarket
    </a>
  </dialog>
</template>

<style scoped>
.price {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2.25rem;
  padding: 0 var(--space-3);
  border-radius: var(--radius-pill);
  border: 1px solid var(--color-border);
  background: var(--color-surface-2);
  color: var(--color-text);
  font-weight: 600;
  font-size: var(--text-sm);
  cursor: pointer;
}
.price:hover {
  border-color: var(--color-primary);
}
.price-dialog {
  width: min(32rem, calc(100vw - 2rem));
  border: none;
  border-radius: var(--radius-lg);
  padding: var(--space-4);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
}
.price-dialog::backdrop {
  background: rgb(0 0 0 / 0.5);
}
.price-dialog__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--space-2);
}
.price-dialog__header h2 {
  margin: 0;
  font-size: var(--text-lg);
}
.price-dialog__note {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
</style>
