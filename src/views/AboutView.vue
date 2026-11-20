<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '@/stores/settings'
import {
  estimateUsage,
  requestPersistence,
  type PersistenceState,
  type StorageUsage,
} from '@/services/storagePersistence'

const { showImages } = storeToRefs(useSettingsStore())
const persistence = ref<PersistenceState | null>(null)
const usage = ref<StorageUsage | null>(null)
const cacheMessage = ref('')

const PERSISTENCE_LABELS: Record<PersistenceState, string> = {
  persisted: 'Oui : le navigateur ne les effacera pas automatiquement.',
  'not-persisted':
    'Non : le navigateur pourrait les effacer si l’appareil manque de place. Exporte ta collection régulièrement.',
  unsupported: 'Information non disponible dans ce navigateur.',
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`
}

async function refreshStorage() {
  persistence.value = await requestPersistence()
  usage.value = await estimateUsage()
}

/** Supprime les images mises en cache par le service worker (Cache Storage). */
async function clearImageCache() {
  if (!('caches' in globalThis)) {
    cacheMessage.value = 'Le cache n’est pas disponible dans ce navigateur.'
    return
  }
  const deleted = await caches.delete('card-images')
  cacheMessage.value = deleted ? 'Images supprimées de cet appareil.' : 'Aucune image en cache.'
  await refreshStorage()
}

onMounted(refreshStorage)
</script>

<template>
  <section aria-labelledby="about-title">
    <h1 id="about-title">À propos</h1>
    <p>
      Application libre (licence MIT) pour gérer sa collection de cartes chez soi. Toutes les
      données restent sur cet appareil.
    </p>

    <h2>Réglages</h2>
    <p>
      <input id="show-images" v-model="showImages" type="checkbox" />
      <label for="show-images">Afficher les images des cartes</label>
    </p>
    <p class="hint">
      Chaque image est téléchargée une seule fois depuis YGOPRODeck puis gardée sur cet appareil.
      Décoche pour ne rien télécharger.
    </p>
    <p>
      <button type="button" @click="clearImageCache">Vider le cache des images</button>
    </p>
    <p role="status" aria-live="polite">{{ cacheMessage }}</p>

    <h2>Stockage</h2>
    <dl>
      <dt>Données protégées contre l’effacement</dt>
      <dd>{{ persistence ? PERSISTENCE_LABELS[persistence] : '…' }}</dd>
      <template v-if="usage">
        <dt>Espace utilisé</dt>
        <dd>
          {{ formatMegabytes(usage.usedBytes) }} sur {{ formatMegabytes(usage.quotaBytes) }}
          disponibles
        </dd>
      </template>
    </dl>

    <h2>Mentions légales</h2>
    <p>
      Projet non officiel, ni produit, ni approuvé, ni affilié à Konami Digital Entertainment ou 4K
      Media. Yu-Gi-Oh! est une marque de Konami. Les noms, textes et illustrations des cartes
      appartiennent à leurs propriétaires.
    </p>
    <p>
      Données et images de cartes fournies par
      <a href="https://ygoprodeck.com/api-guide/" rel="noopener" target="_blank">l'API YGOPRODeck</a
      >. Code source :
      <a href="https://github.com/Happy4Game/YGO-Card-Manager" rel="noopener" target="_blank"
        >GitHub</a
      >.
    </p>
  </section>
</template>

<style scoped>
.hint {
  font-size: 0.9rem;
}
dt {
  font-weight: bold;
}
dd {
  margin: 0 0 0.5rem;
}
</style>
