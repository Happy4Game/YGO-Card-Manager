import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  ApiFormatError,
  ApiHttpError,
  fetchAllCards,
  fetchDbVersion,
  type CardLanguage,
} from '@/api/ygoprodeck'
import { db } from '@/db/database'
import { syncCards, type CardSyncResult } from '@/services/cardSync'

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'done'

/** Traduit une erreur technique en message compréhensible pour l'utilisateur. */
export function toFrenchErrorMessage(error: unknown): string {
  if (error instanceof ApiHttpError) {
    return `YGOPRODeck a répondu avec une erreur (HTTP ${error.status}). Réessaie plus tard.`
  }
  if (error instanceof ApiFormatError) {
    return 'La réponse de YGOPRODeck est inattendue. Réessaie plus tard.'
  }
  // Dexie remonte le nom de l'erreur IndexedDB d'origine.
  // Doc : https://dexie.org/docs/DexieErrors/Dexie.QuotaExceededError
  if (error instanceof Error && error.name === 'QuotaExceededError') {
    return 'Espace de stockage insuffisant sur cet appareil pour enregistrer les cartes.'
  }
  // `fetch` rejette avec une TypeError en cas de problème réseau (hors ligne, CORS…).
  // Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/fetch#exceptions
  if (error instanceof TypeError) {
    return 'Impossible de joindre YGOPRODeck. Vérifie ta connexion internet puis réessaie.'
  }
  return 'La synchronisation a échoué. Réessaie plus tard.'
}

/** État du cache local des cartes et de sa synchronisation (Pinia, syntaxe « setup »). */
export const useCardsStore = defineStore('cards', () => {
  const status = ref<SyncStatus>('idle')
  const lastResult = ref<CardSyncResult | null>(null)
  const errorMessage = ref<string | null>(null)
  const cardCount = ref(0)
  /** Augmente à chaque fois que le contenu de la table `cards` change (caches à invalider). */
  const revision = ref(0)

  async function refreshCount(): Promise<void> {
    cardCount.value = await db.cards.count()
  }

  async function sync(language: CardLanguage = 'fr'): Promise<void> {
    if (status.value === 'syncing') return // évite deux téléchargements simultanés
    status.value = 'syncing'
    errorMessage.value = null
    try {
      const result = await syncCards(
        db,
        { fetchDbVersion: () => fetchDbVersion(), fetchAllCards: (lang) => fetchAllCards(lang) },
        language,
      )
      lastResult.value = result
      cardCount.value = result.count
      if (result.status === 'updated') revision.value += 1
      status.value = 'done'
    } catch (error) {
      errorMessage.value = toFrenchErrorMessage(error)
      status.value = 'error'
    }
  }

  return { status, lastResult, errorMessage, cardCount, revision, refreshCount, sync }
})
