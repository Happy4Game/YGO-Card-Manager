<script setup lang="ts">
import { computed } from 'vue'
import { useCardsStore } from '@/stores/cards'

/**
 * Téléchargement de la base de cartes.
 * `compact` : simple barre d'état quand des cartes sont déjà enregistrées.
 */
defineProps<{ compact?: boolean }>()

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
  <section class="sync" :class="{ compact }" aria-labelledby="sync-title">
    <div class="text">
      <h2 id="sync-title" :class="{ 'visually-hidden': compact }">Base de cartes</h2>
      <p v-if="!compact" class="intro">
        Les données des cartes proviennent de l'API publique
        <a href="https://ygoprodeck.com/api-guide/" rel="noopener" target="_blank">YGOPRODeck</a>.
        Elles sont téléchargées une seule fois puis restent sur ton appareil : la recherche
        fonctionne ensuite hors ligne.
      </p>
      <!-- aria-live="polite" : le lecteur d'écran lit le nouveau texte sans interrompre.
           Doc MDN : https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Attributes/aria-live -->
      <p
        class="status"
        :class="{ error: store.status === 'error' }"
        role="status"
        aria-live="polite"
        :aria-busy="store.status === 'syncing'"
      >
        <span v-if="store.status === 'syncing'" class="spinner" aria-hidden="true"></span>
        {{ statusText }}
      </p>
    </div>
    <button
      type="button"
      class="sync-button"
      :disabled="store.status === 'syncing'"
      @click="store.sync()"
    >
      {{ compact ? 'Mettre à jour' : 'Télécharger / mettre à jour les cartes' }}
    </button>
  </section>
</template>

<style scoped>
.sync {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding: var(--space-5);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}
.sync.compact {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-3);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  box-shadow: none;
}
h2 {
  margin: 0 0 var(--space-2);
  font-size: var(--text-lg);
}
.intro {
  margin: 0 0 var(--space-2);
  color: var(--color-text-muted);
  line-height: 1.5;
}
.status {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.status.error {
  color: var(--color-danger);
  font-weight: 600;
}
a {
  color: var(--color-primary);
}
.sync-button {
  align-self: flex-start;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-4);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}
.compact .sync-button {
  align-self: center;
  min-height: 2.25rem;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text);
  font-size: var(--text-sm);
}
.sync-button:disabled {
  opacity: 0.6;
  cursor: progress;
}
.sync-button:focus-visible,
a:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.spinner {
  flex: none;
  width: 1em;
  height: 1em;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation: none;
  }
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
