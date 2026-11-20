<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { storeToRefs } from 'pinia'
import CollectionEntryForm from '@/components/collection/CollectionEntryForm.vue'
import CollectionEntryItem from '@/components/collection/CollectionEntryItem.vue'
import CollectionFilters from '@/components/collection/CollectionFilters.vue'
import CollectionStats from '@/components/collection/CollectionStats.vue'
import CollectionTransfer from '@/components/collection/CollectionTransfer.vue'
import { routes } from '@/lib/routes'
import {
  fallbackCardName,
  type CollectionItem,
  type NewCollectionEntry,
} from '@/services/collection'
import { useCollectionStore } from '@/stores/collection'

const store = useCollectionStore()
// `storeToRefs` garde la réactivité lors de la déstructuration.
// Doc : https://pinia.vuejs.org/core-concepts/#Destructuring-from-a-Store
const { items, stats, locations, loading, error, filters, sort } = storeToRefs(store)

/** Formulaire ouvert : ajout (carte et impression éventuellement pré-remplies) ou modification. */
type FormState =
  | { mode: 'create'; cardId?: number; setCode?: string }
  | { mode: 'edit'; entry: CollectionItem }
const form = ref<FormState | null>(null)
const formKey = ref(0)

const message = ref('')
const listHeading = useTemplateRef<HTMLHeadingElement>('listHeading')
const isEmpty = computed(() => stats.value.totalCopies === 0)
const hasFilters = computed(
  () =>
    filters.value.text !== '' || filters.value.location !== '' || filters.value.condition !== '',
)

function openForm(state: FormState) {
  form.value = state
  // Changer la clé recrée le formulaire, donc réinitialise ses champs.
  formKey.value += 1
}

/** Lit `?add=<cardId>` : lien « Ajouter à ma collection » des pages Recherche et Scanner. */
function parseCardId(value: string | null): number | undefined {
  if (value === null || !/^\d{1,10}$/.test(value)) return undefined
  const cardId = Number(value)
  return cardId > 0 ? cardId : undefined
}

/** Lit `?set=<code>` : code d'impression facultatif (ex. lu par le scan). */
function parseSetCode(value: string | null): string | undefined {
  const code = value?.trim().toUpperCase() ?? ''
  return /^[A-Z0-9-]{1,20}$/.test(code) ? code : undefined
}

// Page Astro statique : pas de routeur, on lit directement l'URL du navigateur.
// Doc : https://developer.mozilla.org/fr/docs/Web/API/URLSearchParams
const query = new URLSearchParams(window.location.search)
const initialCardId = parseCardId(query.get('add'))
if (initialCardId !== undefined) {
  openForm({ mode: 'create', cardId: initialCardId, setCode: parseSetCode(query.get('set')) })
}

/** Retire `?add=…&set=…` de l'URL sans recharger la page (pas de nouvelle entrée d'historique). */
function clearAddQuery() {
  const url = new URL(window.location.href)
  if (!url.searchParams.has('add') && !url.searchParams.has('set')) return
  url.searchParams.delete('add')
  url.searchParams.delete('set')
  // Doc : https://developer.mozilla.org/fr/docs/Web/API/History/replaceState
  window.history.replaceState(window.history.state, '', url)
}

/** Après une action qui fait disparaître l'élément focalisé, on remet le focus sur la liste. */
async function focusList() {
  await nextTick()
  listHeading.value?.focus()
}

async function closeForm() {
  form.value = null
  clearAddQuery()
  await focusList()
}

function errorText(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause)
}

async function save(entry: NewCollectionEntry) {
  const current = form.value
  if (!current) return
  try {
    if (current.mode === 'edit') {
      await store.update(current.entry.id, entry)
      message.value = `Entrée modifiée : ${current.entry.cardName}.`
    } else {
      await store.add(entry)
      const card = await store.findCard(entry.cardId)
      const name = card?.name ?? fallbackCardName(entry.cardId)
      message.value = `Ajouté à la collection : ${name} × ${entry.quantity}.`
    }
    await closeForm()
  } catch (cause) {
    message.value = `Enregistrement impossible : ${errorText(cause)}`
  }
}

async function changeQuantity(item: CollectionItem, delta: number) {
  try {
    const quantity = await store.changeQuantity(item.id, delta)
    message.value =
      quantity === 0
        ? `Supprimé : ${item.cardName}.`
        : `Quantité de ${item.cardName} : ${quantity}.`
  } catch (cause) {
    message.value = `Modification impossible : ${errorText(cause)}`
  }
}

async function remove(item: CollectionItem) {
  try {
    await store.remove(item.id)
    message.value = `Supprimé : ${item.cardName}.`
    await focusList()
  } catch (cause) {
    message.value = `Suppression impossible : ${errorText(cause)}`
  }
}
</script>

<template>
  <section class="collection" aria-labelledby="collection-title">
    <header class="page-header collection__header">
      <div>
        <h1 id="collection-title">Ma collection</h1>
        <p>Tes cartes, rangées sur cet appareil.</p>
      </div>
      <button
        v-if="!form"
        type="button"
        class="btn--primary collection__add"
        @click="openForm({ mode: 'create' })"
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter une carte
      </button>
    </header>

    <!-- Messages des actions, annoncés par les lecteurs d'écran (role="status" = aria-live poli).
         La zone reste dans la page même vide : masquée, elle ne serait plus annoncée. -->
    <p
      class="status"
      :class="{ 'notice notice--success': message }"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
    <p v-if="error" class="notice notice--danger" role="alert">
      Erreur de la base locale : {{ error }}
    </p>

    <CollectionEntryForm
      v-if="form"
      :key="formKey"
      :entry="form.mode === 'edit' ? form.entry : undefined"
      :initial-card-id="form.mode === 'create' ? form.cardId : undefined"
      :initial-set-code="form.mode === 'create' ? form.setCode : undefined"
      :locations="locations"
      :find-card="store.findCard"
      @submit="save"
      @cancel="closeForm"
    />

    <p v-if="loading" class="muted">Chargement de la collection…</p>
    <template v-else>
      <CollectionStats v-if="!isEmpty" :stats="stats" />

      <section class="entries" aria-labelledby="entries-title">
        <h2 id="entries-title" ref="listHeading" tabindex="-1">Mes cartes</h2>

        <div v-if="isEmpty" class="empty surface">
          <svg
            class="empty__art"
            viewBox="0 0 96 96"
            width="96"
            height="96"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="18"
              y="20"
              width="40"
              height="58"
              rx="6"
              transform="rotate(-10 38 49)"
              fill="var(--color-surface-2)"
              stroke="var(--color-border)"
              stroke-width="2"
            />
            <rect
              x="38"
              y="16"
              width="40"
              height="58"
              rx="6"
              fill="var(--color-primary-soft)"
              stroke="var(--color-primary)"
              stroke-width="2"
            />
            <path
              d="M58 36v22M47 47h22"
              stroke="var(--color-primary)"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
          <p class="empty__title"><strong>Ta collection est vide.</strong></p>
          <p class="muted">
            Pour ajouter une carte, cherche-la dans <a :href="routes.search()">Recherche</a> ou
            <a :href="routes.scan()">scanne-la</a>, puis choisis « Ajouter à ma collection ». Tu
            peux aussi la saisir manuellement avec son identifiant (passcode), ou importer une
            sauvegarde ci-dessous.
          </p>
        </div>

        <template v-else>
          <CollectionFilters
            v-model:text="filters.text"
            v-model:location="filters.location"
            v-model:condition="filters.condition"
            v-model:sort-key="sort.key"
            v-model:sort-direction="sort.direction"
            :locations="locations"
            @reset="store.resetFilters"
          />

          <p class="count muted">{{ items.length }} entrée(s) affichée(s)</p>

          <ul v-if="items.length > 0" class="list">
            <CollectionEntryItem
              v-for="item in items"
              :key="item.id"
              :item="item"
              @increment="changeQuantity($event, 1)"
              @decrement="changeQuantity($event, -1)"
              @edit="openForm({ mode: 'edit', entry: $event })"
              @remove="remove"
            />
          </ul>
          <div v-else-if="hasFilters" class="no-match surface surface--muted">
            <p>Aucune entrée ne correspond aux filtres.</p>
            <button type="button" class="btn--secondary" @click="store.resetFilters">
              Réinitialiser les filtres
            </button>
          </div>
        </template>
      </section>
    </template>

    <CollectionTransfer />
  </section>
</template>

<style scoped>
.collection {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.collection__header {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--space-3);
  margin: 0;
}

.collection__header p {
  margin-top: var(--space-1);
}

@media (max-width: 30rem) {
  .collection__add {
    width: 100%;
  }
}

/* Vide, la zone sort du flux sans être masquée (display: none empêcherait l'annonce). */
.status:empty {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.entries {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.count {
  font-size: var(--text-sm);
}

.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-3);
  padding: 0;
  margin: 0;
}

.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-2);
  padding-block: var(--space-6);
  text-align: center;
}

.empty__art {
  margin-bottom: var(--space-2);
}

.empty__title {
  font-size: var(--text-lg);
}

.empty p {
  max-width: 34rem;
}

.no-match {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}
</style>
