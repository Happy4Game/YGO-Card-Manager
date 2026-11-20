<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
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

/** Part de l'espace utilisé, de 0 à 100, pour la jauge. */
const usagePercent = computed(() => {
  if (!usage.value || usage.value.quotaBytes === 0) return 0
  return Math.min(100, (usage.value.usedBytes / usage.value.quotaBytes) * 100)
})

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
  <section class="about" aria-labelledby="about-title">
    <header class="page-header">
      <h1 id="about-title">À propos</h1>
      <p>
        Application libre (licence MIT) pour gérer sa collection de cartes chez soi. Toutes les
        données restent sur cet appareil.
      </p>
    </header>

    <section class="surface stack" aria-labelledby="settings-title">
      <h2 id="settings-title">Réglages</h2>
      <div>
        <label class="check" for="show-images">
          <input id="show-images" v-model="showImages" type="checkbox" />
          Afficher les images des cartes
        </label>
        <p class="hint">
          Chaque image est téléchargée une seule fois depuis YGOPRODeck puis gardée sur cet
          appareil. Décoche pour ne rien télécharger.
        </p>
      </div>
      <div class="cluster">
        <button type="button" class="btn--secondary" @click="clearImageCache">
          Vider le cache des images
        </button>
        <p class="muted" role="status" aria-live="polite">{{ cacheMessage }}</p>
      </div>
    </section>

    <section class="surface stack" aria-labelledby="storage-title">
      <h2 id="storage-title">Stockage</h2>
      <dl class="facts">
        <div>
          <dt>Données protégées contre l’effacement</dt>
          <dd>{{ persistence ? PERSISTENCE_LABELS[persistence] : '…' }}</dd>
        </div>
        <div v-if="usage">
          <dt>Espace utilisé</dt>
          <dd>
            {{ formatMegabytes(usage.usedBytes) }} sur {{ formatMegabytes(usage.quotaBytes) }}
            disponibles
            <!-- Jauge décorative : la valeur exacte est déjà écrite juste au-dessus. -->
            <span class="gauge" aria-hidden="true">
              <span class="gauge__fill" :style="{ inlineSize: `${usagePercent}%` }"></span>
            </span>
          </dd>
        </div>
      </dl>
    </section>

    <section class="surface stack" aria-labelledby="legal-title">
      <h2 id="legal-title">Mentions légales</h2>
      <p>
        Projet non officiel, ni produit, ni approuvé, ni affilié à Konami Digital Entertainment ou
        4K Media. Yu-Gi-Oh! est une marque de Konami. Les noms, textes et illustrations des cartes
        appartiennent à leurs propriétaires.
      </p>
      <p>
        Données et images de cartes fournies par
        <a href="https://ygoprodeck.com/api-guide/" rel="noopener" target="_blank"
          >l'API YGOPRODeck</a
        >. Code source&nbsp;:
        <a href="https://github.com/Happy4Game/YGO-Card-Manager" rel="noopener" target="_blank"
          >GitHub</a
        >.
      </p>
    </section>
  </section>
</template>

<style scoped>
.about {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: 48rem;
}

.facts {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.facts dt {
  font-weight: 650;
}

.facts dd {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
}

.gauge {
  display: block;
  height: 0.5rem;
  margin-top: var(--space-2);
  overflow: hidden;
  border-radius: var(--radius-pill);
  background: var(--color-surface-2);
}

.gauge__fill {
  display: block;
  /* Au moins un trait visible, même pour un usage minime. */
  min-inline-size: 0.5rem;
  height: 100%;
  border-radius: inherit;
  background: var(--color-primary);
}
</style>
