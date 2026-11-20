<script setup lang="ts">
import { computed } from 'vue'
import { useCardsStore } from '@/stores/cards'

const store = useCardsStore()

const numberFormat = new Intl.NumberFormat('fr-FR')

/** Texte annoncé par les lecteurs d'écran à chaque changement (zone aria-live). */
const statusText = computed(() => {
  switch (store.status) {
    case 'syncing':
      return 'Téléchargement en cours… Cela peut prendre une minute.'
    case 'error':
      return store.errorMessage ?? 'La synchronisation a échoué.'
    case 'done':
      return store.lastResult?.status === 'up-to-date'
        ? `Les cartes sont déjà à jour (${numberFormat.format(store.cardCount)} cartes).`
        : `${numberFormat.format(store.cardCount)} cartes enregistrées sur cet appareil.`
    default:
      return store.cardCount > 0
        ? `${numberFormat.format(store.cardCount)} cartes disponibles hors ligne.`
        : "Aucune carte n'est encore enregistrée sur cet appareil."
  }
})
</script>

<template>
  <section class="sync" aria-labelledby="sync-title">
    <h2 id="sync-title">Base de cartes</h2>
    <p>
      Les données des cartes proviennent de l'API publique
      <a href="https://ygoprodeck.com/api-guide/" rel="noopener" target="_blank">YGOPRODeck</a>.
      Elles sont téléchargées une seule fois puis restent sur ton appareil : la recherche fonctionne
      ensuite hors ligne.
    </p>
    <button type="button" :disabled="store.status === 'syncing'" @click="store.sync()">
      Télécharger / mettre à jour les cartes
    </button>
    <!-- aria-live="polite" : le lecteur d'écran lit le nouveau texte sans interrompre l'utilisateur.
         Doc MDN : https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Attributes/aria-live -->
    <p
      class="status"
      :class="{ error: store.status === 'error' }"
      role="status"
      aria-live="polite"
      :aria-busy="store.status === 'syncing'"
    >
      {{ statusText }}
    </p>
  </section>
</template>

<style scoped>
.sync {
  margin-block: 1rem;
}
.status.error {
  color: #a40000;
  font-weight: bold;
}
button:focus-visible,
a:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
</style>
