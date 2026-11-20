<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useTemplateRef, watch } from 'vue'
import CardResultItem from '@/components/search/CardResultItem.vue'
import CardSearchForm from '@/components/search/CardSearchForm.vue'
import CardSyncPanel from '@/components/search/CardSyncPanel.vue'
import { db } from '@/db/database'
import {
  DEFAULT_PAGE_SIZE,
  listFilterOptions,
  searchCards,
  type CardFilterOptions,
  type CardSearchFilters,
  type CardSearchResult,
} from '@/services/cardSearch'
import { useCardsStore } from '@/stores/cards'

const store = useCardsStore()

const options = ref<CardFilterOptions>({ types: [], attributes: [], races: [] })
const filters = ref<CardSearchFilters>({})
const page = ref(0)
const result = ref<CardSearchResult>({ items: [], total: 0 })
const loading = ref(false)
const searchError = ref<string | null>(null)
const resultsTitle = useTemplateRef<HTMLHeadingElement>('results-title')

const pageCount = computed(() => Math.max(1, Math.ceil(result.value.total / DEFAULT_PAGE_SIZE)))
const resultsText = computed(() => {
  if (loading.value) return 'Recherche en cours…'
  if (searchError.value) return searchError.value
  const { total } = result.value
  if (total === 0) return 'Aucune carte ne correspond à ces critères.'
  return `${total} carte${total > 1 ? 's' : ''} trouvée${total > 1 ? 's' : ''}, page ${page.value + 1} sur ${pageCount.value}.`
})

async function runSearch(): Promise<void> {
  loading.value = true
  searchError.value = null
  try {
    result.value = await searchCards(db, filters.value, {
      limit: DEFAULT_PAGE_SIZE,
      offset: page.value * DEFAULT_PAGE_SIZE,
    })
  } catch {
    searchError.value = 'La recherche a échoué. Recharge la page puis réessaie.'
  } finally {
    loading.value = false
  }
}

async function loadLocalData(): Promise<void> {
  if (store.cardCount === 0) return
  options.value = await listFilterOptions(db)
  await runSearch()
}

function onSearch(newFilters: CardSearchFilters): void {
  filters.value = newFilters
  page.value = 0
  void runSearch()
}

async function goToPage(newPage: number): Promise<void> {
  page.value = newPage
  await runSearch()
  // On place le focus sur le titre des résultats pour que l'utilisateur au clavier
  // ou au lecteur d'écran reparte du début de la nouvelle page.
  await nextTick()
  resultsTitle.value?.focus()
}

onMounted(async () => {
  await store.refreshCount()
  await loadLocalData()
})

// Après un téléchargement réussi, on recharge les filtres et les résultats.
watch(
  () => store.status,
  (status) => {
    if (status === 'done') void loadLocalData()
  },
)
</script>

<template>
  <section aria-labelledby="search-title">
    <h1 id="search-title">Recherche</h1>

    <CardSyncPanel />

    <template v-if="store.cardCount > 0">
      <h2>Critères</h2>
      <CardSearchForm :options="options" :disabled="loading" @search="onSearch" />

      <section class="results" aria-labelledby="results-title">
        <h2 id="results-title" ref="results-title" tabindex="-1">Résultats</h2>
        <p role="status" aria-live="polite">{{ resultsText }}</p>

        <ul v-if="result.items.length > 0" class="result-list">
          <li v-for="card in result.items" :key="card.id">
            <CardResultItem :card="card" />
          </li>
        </ul>

        <nav v-if="pageCount > 1" class="pagination" aria-label="Pagination des résultats">
          <button type="button" :disabled="loading || page === 0" @click="goToPage(page - 1)">
            Page précédente
          </button>
          <span>Page {{ page + 1 }} sur {{ pageCount }}</span>
          <button
            type="button"
            :disabled="loading || page + 1 >= pageCount"
            @click="goToPage(page + 1)"
          >
            Page suivante
          </button>
        </nav>
      </section>
    </template>
  </section>
</template>

<style scoped>
.result-list {
  list-style: none;
  padding: 0;
  display: grid;
  gap: 0.75rem;
}
.pagination {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-block: 1rem;
}
.pagination button:focus-visible,
#results-title:focus-visible {
  outline: 3px solid currentColor;
  outline-offset: 2px;
}
</style>
