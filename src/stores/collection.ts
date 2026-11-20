import { defineStore } from 'pinia'
import { liveQuery, type Subscription } from 'dexie'
import { onScopeDispose, reactive, ref, shallowRef, watch } from 'vue'
import { db } from '@/db/database'
import type { CardData } from '@/domain/card'
import * as service from '@/services/collection'
import type {
  CollectionEntryChanges,
  CollectionFilters,
  CollectionItem,
  CollectionSort,
  CollectionStats,
  NewCollectionEntry,
} from '@/services/collection'
import {
  downloadFile,
  exportFilename,
  exportToCsv,
  exportToJson,
  importFromJson,
  type ImportMode,
  type ImportResult,
} from '@/services/collectionTransfer'

/**
 * Store Pinia de la collection (syntaxe « setup » : https://pinia.vuejs.org/core-concepts/#Setup-Stores).
 *
 * Les données affichées viennent de `liveQuery` (https://dexie.org/docs/liveQuery()) : Dexie
 * relance la requête dès qu'une table lue change, même depuis un autre onglet. Les actions
 * n'ont donc qu'à écrire en base, l'affichage se met à jour tout seul.
 */
export const useCollectionStore = defineStore('collection', () => {
  const filters = reactive<Required<CollectionFilters>>({ text: '', location: '', condition: '' })
  const sort = reactive<CollectionSort>({ key: 'addedAt', direction: 'desc' })

  // `shallowRef` : on remplace le tableau entier à chaque résultat, inutile de le rendre
  // réactif en profondeur. Doc : https://vuejs.org/api/reactivity-advanced.html#shallowref
  const items = shallowRef<CollectionItem[]>([])
  const stats = shallowRef<CollectionStats>(service.computeStats([]))
  const locations = shallowRef<string[]>([])
  /** `true` tant que la première lecture n'est pas terminée (évite un faux « collection vide »). */
  const loading = ref(true)
  const error = ref<string | null>(null)

  function onError(cause: unknown) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }

  // Statistiques et emplacements : toute la collection, indépendamment des filtres.
  const summarySubscription = liveQuery(async () => ({
    stats: await service.getStats(db),
    locations: await service.listLocations(db),
  })).subscribe({
    next: (value) => {
      stats.value = value.stats
      locations.value = value.locations
      loading.value = false
    },
    error: onError,
  })

  // Liste filtrée : on se réabonne quand les filtres ou le tri changent.
  let listSubscription: Subscription | undefined
  watch(
    [filters, sort],
    () => {
      listSubscription?.unsubscribe()
      const currentFilters = { ...filters }
      const currentSort = { ...sort }
      listSubscription = liveQuery(() =>
        service.listEntries(db, currentFilters, currentSort),
      ).subscribe({
        next: (value) => {
          items.value = value
        },
        error: onError,
      })
    },
    { immediate: true },
  )

  // Libère les abonnements si le store est détruit (ex. `store.$dispose()` dans un test).
  onScopeDispose(() => {
    summarySubscription.unsubscribe()
    listSubscription?.unsubscribe()
  })

  function resetFilters() {
    filters.text = ''
    filters.location = ''
    filters.condition = ''
  }

  const add = (entry: NewCollectionEntry) => service.addEntry(db, entry)
  const update = (id: number, changes: CollectionEntryChanges) =>
    service.updateEntry(db, id, changes)
  const remove = (id: number) => service.removeEntry(db, id)
  const changeQuantity = (id: number, delta: number) => service.changeQuantity(db, id, delta)
  const findCard = (cardId: number): Promise<CardData | undefined> => service.findCard(db, cardId)

  async function exportJson() {
    downloadFile(exportFilename('json'), await exportToJson(db), 'application/json')
  }

  async function exportCsv() {
    downloadFile(exportFilename('csv'), await exportToCsv(db), 'text/csv;charset=utf-8')
  }

  const importJson = (json: string, mode: ImportMode): Promise<ImportResult> =>
    importFromJson(db, json, mode)

  return {
    filters,
    sort,
    items,
    stats,
    locations,
    loading,
    error,
    resetFilters,
    add,
    update,
    remove,
    changeQuantity,
    findCard,
    exportJson,
    exportCsv,
    importJson,
  }
})
