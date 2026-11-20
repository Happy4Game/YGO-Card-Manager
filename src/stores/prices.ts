import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db } from '@/db/database'
import { fetchCardPrices } from '@/api/ygoprodeck'
import type { PricePoint } from '@/domain/price'
import { latestPrices, refreshCollectionPrices } from '@/services/priceTracker'

/** Prix des cartes de la collection : mise à jour quotidienne et derniers relevés. */
export const usePricesStore = defineStore('prices', () => {
  const latest = ref(new Map<number, PricePoint>())
  const refreshing = ref(false)
  const error = ref('')

  async function loadLatest(cardIds: readonly number[]) {
    latest.value = await latestPrices(db, cardIds)
  }

  /** Mise à jour au plus une fois par jour (ou forcée), puis rechargement des derniers prix. */
  async function refresh(cardIds: readonly number[], force = false) {
    if (refreshing.value) return
    refreshing.value = true
    error.value = ''
    try {
      await refreshCollectionPrices(db, (ids) => fetchCardPrices(ids), { force })
    } catch {
      // Hors ligne ou API indisponible : on garde les derniers prix connus.
      error.value = 'Prix non mis à jour (connexion indisponible ?). Derniers prix connus affichés.'
    } finally {
      refreshing.value = false
    }
    await loadLatest(cardIds)
  }

  return { latest, refreshing, error, loadLatest, refresh }
})
