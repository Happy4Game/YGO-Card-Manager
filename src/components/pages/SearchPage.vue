<script setup lang="ts">
/**
 * Page de recherche : champ universel (« n'importe quoi »), puces des critères compris,
 * mode avancé synchronisé avec le champ, résultats en direct.
 * Montée comme île Vue (`client:only="vue"`) : pas de vue-router, liens via `@/lib/routes`.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import AdvancedSearchForm from '@/components/search/AdvancedSearchForm.vue'
import CardResultItem from '@/components/search/CardResultItem.vue'
import CardSyncPanel from '@/components/search/CardSyncPanel.vue'
import QueryChips from '@/components/search/QueryChips.vue'
import SearchHelp from '@/components/search/SearchHelp.vue'
import { searchEngine } from '@/services/search'
import { parseQuery, removeToken } from '@/services/search/queryParser'
import {
  DEFAULT_PAGE_SIZE,
  SORT_OPTIONS,
  isSortOption,
  type SearchFacets,
  type SearchHit,
  type SortOption,
} from '@/services/search/searchEngine'
import { useCardsStore } from '@/stores/cards'

const store = useCardsStore()

// --- Mémoire de la dernière recherche (sessionStorage, propre à l'onglet) -------------
// Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/sessionStorage
const STORAGE_KEY = 'search:last'

interface SavedSearch {
  query: string
  sort: SortOption
  advanced: boolean
}

function readSaved(): SavedSearch {
  const fallback: SavedSearch = { query: '', sort: 'relevance', advanced: false }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) return fallback
    // Donnée relue : on vérifie chaque champ au lieu de faire confiance au JSON.
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return fallback
    const query = 'query' in value && typeof value.query === 'string' ? value.query : ''
    const sort =
      'sort' in value && typeof value.sort === 'string' && isSortOption(value.sort)
        ? value.sort
        : 'relevance'
    const advanced = 'advanced' in value && value.advanced === true
    return { query, sort, advanced }
  } catch {
    return fallback // stockage bloqué ou JSON invalide : on repart de zéro
  }
}

const saved = readSaved()
const query = ref(saved.query)
const sort = ref<SortOption>(saved.sort)
const advancedOpen = ref(saved.advanced)
const helpOpen = ref(false)

watch([query, sort, advancedOpen], ([q, s, a]) => {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ query: q, sort: s, advanced: a }))
  } catch {
    // Non mémorisé : sans gravité.
  }
})

// --- Analyse et exécution -------------------------------------------------------------
const parsed = computed(() => parseQuery(query.value))
const ready = ref(false)
const hasCards = computed(() => store.cardCount > 0)
const hits = ref<SearchHit[]>([])
const total = ref(0)
const durationMs = ref(0)
const loading = ref(false)
const searchError = ref<string | null>(null)
const facets = ref<SearchFacets | null>(null)

let requestId = 0

async function runSearch(): Promise<void> {
  if (!hasCards.value) return
  const id = ++requestId
  loading.value = true
  searchError.value = null
  try {
    const result = await searchEngine.search(parsed.value.query, {
      sort: sort.value,
      limit: DEFAULT_PAGE_SIZE,
    })
    if (id !== requestId) return // une recherche plus récente est partie entre-temps
    hits.value = result.hits
    total.value = result.total
    durationMs.value = result.durationMs
  } catch {
    if (id === requestId)
      searchError.value = 'La recherche a échoué. Recharge la page puis réessaie.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

// Résultats en direct : on attend 200 ms sans frappe avant de chercher (« debounce »).
// Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/setTimeout
let debounceTimer: ReturnType<typeof setTimeout> | undefined
watch(query, () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => void runSearch(), 200)
})
watch(sort, () => void runSearch())

function searchNow(): void {
  clearTimeout(debounceTimer)
  void runSearch()
}

const listRef = useTemplateRef<HTMLUListElement>('result-list')
const loadingMore = ref(false)

/** « Afficher plus » : ajoute une page puis place le focus sur la première nouvelle carte. */
async function loadMore(): Promise<void> {
  const id = requestId
  const firstNew = hits.value.length
  loadingMore.value = true
  try {
    const result = await searchEngine.search(parsed.value.query, {
      sort: sort.value,
      offset: firstNew,
      limit: DEFAULT_PAGE_SIZE,
    })
    if (id !== requestId) return
    hits.value = [...hits.value, ...result.hits]
    total.value = result.total
    await nextTick()
    listRef.value?.children[firstNew]?.querySelector<HTMLElement>('article')?.focus()
  } finally {
    loadingMore.value = false
  }
}

async function loadLocalData(): Promise<void> {
  if (!hasCards.value) return
  searchNow()
  facets.value = await searchEngine.facets()
}

// Après une synchronisation qui a changé les cartes : cache, listes et résultats à refaire.
watch(
  () => store.revision,
  () => {
    searchEngine.invalidate()
    void loadLocalData()
  },
)
watch(hasCards, (now, before) => {
  if (now && !before) void loadLocalData()
})

// --- Champ universel ------------------------------------------------------------------
const inputRef = useTemplateRef<HTMLInputElement>('search-input')
const helpButton = useTemplateRef<HTMLButtonElement>('help-button')

function clearQuery(): void {
  query.value = ''
  searchNow()
  inputRef.value?.focus()
}

function removeChip(tokenIndex: number): void {
  query.value = removeToken(query.value, tokenIndex)
  searchNow()
  inputRef.value?.focus()
}

function useExample(example: string): void {
  query.value = example
  helpOpen.value = false
  searchNow()
  inputRef.value?.focus()
}

async function toggleHelp(): Promise<void> {
  helpOpen.value = !helpOpen.value
  await nextTick()
  // À l'ouverture, le focus va sur le titre de l'aide ; à la fermeture, il revient au bouton.
  if (helpOpen.value) document.getElementById('search-help-title')?.focus()
  else helpButton.value?.focus()
}

function closeHelp(): void {
  if (!helpOpen.value) return
  helpOpen.value = false
  helpButton.value?.focus()
}

/** Raccourci « / » pour revenir au champ de recherche, comme sur beaucoup de sites. */
function onGlobalKey(event: KeyboardEvent): void {
  if (event.key === 'Escape') closeHelp()
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return
  const target = event.target
  const typing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  if (typing) return
  event.preventDefault()
  inputRef.value?.focus()
}

onMounted(async () => {
  document.addEventListener('keydown', onGlobalKey)
  try {
    await store.refreshCount()
  } finally {
    ready.value = true
  }
  await loadLocalData()
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onGlobalKey)
  clearTimeout(debounceTimer)
})

// --- Textes ---------------------------------------------------------------------------
const numberFormat = new Intl.NumberFormat('fr-FR')
const summary = computed(() => {
  if (searchError.value) return searchError.value
  if (loading.value && hits.value.length === 0) return 'Recherche…'
  const n = total.value
  if (n === 0) return 'Aucune carte'
  return `${numberFormat.format(n)} carte${n > 1 ? 's' : ''}`
})
const remaining = computed(() => total.value - hits.value.length)

const EXAMPLES = [
  'dragon',
  'atk>=2500 type:dragon',
  'ABC-FR001',
  'type:magie race:jeu-rapide',
  'niv:4 attr:ténèbres',
  'type:lien fleche:haut',
  'in:collection',
]
</script>

<template>
  <section class="search-page" aria-labelledby="search-title">
    <h1 id="search-title">Recherche</h1>

    <template v-if="ready && !hasCards">
      <CardSyncPanel />
      <p class="empty-note">
        Une fois les cartes téléchargées, tu pourras chercher par nom (français ou anglais), code
        imprimé, ATK, type, archétype… le tout hors ligne.
      </p>
    </template>

    <template v-else-if="ready">
      <div class="search-bar" role="search">
        <label for="universal-search" class="visually-hidden">Rechercher des cartes</label>
        <div class="input-wrap">
          <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
            <path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
          <input
            id="universal-search"
            ref="search-input"
            v-model="query"
            type="search"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            enterkeyhint="search"
            placeholder="Nom, ABC-FR001, atk>=2500 type:dragon…"
            aria-describedby="search-hint"
            @keydown.enter.prevent="searchNow"
          />
          <button v-if="query" type="button" class="clear" @click="clearQuery">
            <span aria-hidden="true">×</span>
            <span class="visually-hidden">Effacer la recherche</span>
          </button>
        </div>
        <button
          ref="help-button"
          type="button"
          class="help-button"
          :aria-expanded="helpOpen"
          aria-controls="search-help"
          @click="toggleHelp"
        >
          <span aria-hidden="true">?</span>
          <span class="visually-hidden">Aide sur la syntaxe de recherche</span>
        </button>
      </div>
      <p id="search-hint" class="hint">
        Nom, texte, passcode, code d'impression ou filtres combinés. Raccourci : touche « / ».
      </p>

      <div v-show="helpOpen" id="search-help" class="help-panel">
        <SearchHelp heading-id="search-help-title" @example="useExample" @close="closeHelp" />
      </div>

      <QueryChips :chips="parsed.chips" :warnings="parsed.warnings" @remove="removeChip" />

      <div class="toolbar">
        <button
          type="button"
          class="advanced-toggle"
          :aria-expanded="advancedOpen"
          aria-controls="advanced-panel"
          @click="advancedOpen = !advancedOpen"
        >
          <span class="chevron" aria-hidden="true"></span>
          Recherche avancée
        </button>
        <label class="sort">
          <span>Trier par</span>
          <select v-model="sort">
            <option v-for="option in SORT_OPTIONS" :key="option.value" :value="option.value">
              {{ option.label }}
            </option>
          </select>
        </label>
      </div>

      <div v-show="advancedOpen" id="advanced-panel" class="advanced-panel">
        <AdvancedSearchForm v-model:query="query" :facets="facets" />
      </div>

      <section class="results" aria-labelledby="results-title" :aria-busy="loading">
        <h2 id="results-title" class="visually-hidden">Résultats</h2>
        <p class="summary">
          <span role="status" aria-live="polite" :class="{ error: searchError }">{{
            summary
          }}</span>
          <span v-if="total > 0 && !loading" class="duration" aria-hidden="true">
            · {{ Math.max(1, Math.round(durationMs)) }} ms
          </span>
        </p>

        <div v-if="parsed.isEmpty" class="examples">
          <p>Quelques idées :</p>
          <ul>
            <li v-for="example in EXAMPLES" :key="example">
              <button type="button" class="example" @click="useExample(example)">
                <code>{{ example }}</code>
              </button>
            </li>
          </ul>
        </div>

        <div v-if="!loading && !searchError && total === 0" class="no-result">
          <p><strong>Aucune carte ne correspond.</strong></p>
          <ul>
            <li>Retire un critère en cliquant sur sa croix ci-dessus.</li>
            <li>Vérifie l'orthographe, ou cherche le nom anglais : <code>en:dragon</code>.</li>
            <li v-if="parsed.query.ownedOnly">
              <code>in:collection</code> ne montre que les cartes déjà ajoutées à ta collection.
            </li>
          </ul>
        </div>

        <ul ref="result-list" class="result-list">
          <li v-for="hit in hits" :key="hit.card.id">
            <CardResultItem :hit="hit" />
          </li>
        </ul>

        <button
          v-if="remaining > 0"
          type="button"
          class="more"
          :disabled="loadingMore"
          @click="loadMore"
        >
          Afficher plus ({{ numberFormat.format(remaining) }} restante{{
            remaining > 1 ? 's' : ''
          }})
        </button>
      </section>

      <CardSyncPanel compact />
    </template>
  </section>
</template>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
  max-width: 72rem;
  margin-inline: auto;
  color: var(--color-text);
  font-family: var(--font-sans);
}
h1 {
  margin: 0;
  font-size: var(--text-xl);
}
.empty-note {
  margin: 0;
  color: var(--color-text-muted);
}
.search-bar {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  gap: var(--space-2);
  padding-block: var(--space-2);
  background: var(--color-bg);
}
.input-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}
.icon {
  position: absolute;
  top: 50%;
  left: var(--space-3);
  width: 1.25rem;
  height: 1.25rem;
  transform: translateY(-50%);
  color: var(--color-text-muted);
  pointer-events: none;
}
#universal-search {
  box-sizing: border-box;
  width: 100%;
  min-height: 3.25rem;
  padding: var(--space-2) 3rem var(--space-2) 2.75rem;
  border: 2px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-md);
  box-shadow: var(--shadow-sm);
  transition: border-color var(--transition-fast);
}
#universal-search::placeholder {
  color: var(--color-text-muted);
}
#universal-search:focus {
  border-color: var(--color-primary);
  outline: none;
}
#universal-search:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
/* On masque la croix native du champ « search » : la nôtre est plus grande et étiquetée. */
#universal-search::-webkit-search-cancel-button {
  appearance: none;
}
.clear {
  position: absolute;
  top: 50%;
  right: var(--space-2);
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  transform: translateY(-50%);
  border: none;
  border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: var(--text-lg);
  cursor: pointer;
}
.help-button {
  flex: none;
  width: 3.25rem;
  height: 3.25rem;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-primary);
  font: inherit;
  font-size: var(--text-lg);
  font-weight: 700;
  cursor: pointer;
}
.help-button[aria-expanded='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.hint {
  margin: calc(-1 * var(--space-2)) 0 0;
  padding-inline: var(--space-3);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
.advanced-toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 2.75rem;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
/* Chevron dessiné en CSS (deux bordures tournées) : identique sur toutes les polices. */
.chevron {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(-45deg);
  transition: transform var(--transition-fast);
}
.advanced-toggle[aria-expanded='true'] .chevron {
  transform: rotate(45deg);
}
.sort {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.sort select {
  min-height: 2.75rem;
  max-width: 13rem;
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
}
/* Les composants ne supposent pas de « box-sizing » global : chacun le fixe s'il en a besoin. */
.advanced-panel {
  padding: var(--space-3);
  border-radius: var(--radius-lg);
  background: var(--color-surface-2);
}
.results {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.summary {
  margin: 0;
  font-weight: 600;
}
.summary .error {
  color: var(--color-danger);
}
.duration {
  font-weight: 400;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.examples p,
.no-result p {
  margin: 0 0 var(--space-2);
}
.examples ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}
.example {
  min-height: 2.25rem;
  padding: var(--space-1) var(--space-3);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--color-primary);
  font: inherit;
  cursor: pointer;
}
.no-result {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
}
.no-result ul {
  margin: 0;
  padding-left: var(--space-5);
  color: var(--color-text-muted);
}
code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}
.result-list {
  display: grid;
  /* min(100%, …) : une seule colonne sur un écran de 360 px, sans défilement horizontal. */
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}
.result-list:empty {
  display: none;
}
.more {
  align-self: center;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-5);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-primary);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
}
.more:disabled {
  opacity: 0.6;
  cursor: progress;
}
.clear:focus-visible,
.help-button:focus-visible,
.advanced-toggle:focus-visible,
.sort select:focus-visible,
.example:focus-visible,
.more:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
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
