<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import CollectionEntryForm from '@/components/collection/CollectionEntryForm.vue'
import CollectionEntryItem from '@/components/collection/CollectionEntryItem.vue'
import CollectionFilters from '@/components/collection/CollectionFilters.vue'
import CollectionStats from '@/components/collection/CollectionStats.vue'
import CollectionTransfer from '@/components/collection/CollectionTransfer.vue'
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

const route = useRoute()
const router = useRouter()

/** Formulaire ouvert : ajout (avec carte éventuellement pré-remplie) ou modification. */
type FormState = { mode: 'create'; cardId?: number } | { mode: 'edit'; entry: CollectionItem }
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

/** Lit `?add=<cardId>` : c'est le lien « Ajouter à ma collection » de la page Recherche. */
function parseAddQuery(value: unknown): number | undefined {
  if (typeof value !== 'string' || !/^\d{1,10}$/.test(value)) return undefined
  const cardId = Number(value)
  return cardId > 0 ? cardId : undefined
}

watch(
  () => route.query.add,
  (value) => {
    const cardId = parseAddQuery(value)
    if (cardId !== undefined) openForm({ mode: 'create', cardId })
  },
  { immediate: true },
)

async function clearAddQuery() {
  if (route.query.add === undefined) return
  const query = { ...route.query }
  delete query.add
  await router.replace({ query })
}

/** Après une action qui fait disparaître l'élément focalisé, on remet le focus sur la liste. */
async function focusList() {
  await nextTick()
  listHeading.value?.focus()
}

async function closeForm() {
  form.value = null
  await clearAddQuery()
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
    <h1 id="collection-title">Ma collection</h1>

    <!-- Messages des actions, annoncés par les lecteurs d'écran (role="status" = aria-live poli). -->
    <p class="status" role="status" aria-live="polite">{{ message }}</p>
    <p v-if="error" class="error" role="alert">Erreur de la base locale : {{ error }}</p>

    <CollectionEntryForm
      v-if="form"
      :key="formKey"
      :entry="form.mode === 'edit' ? form.entry : undefined"
      :initial-card-id="form.mode === 'create' ? form.cardId : undefined"
      :locations="locations"
      :find-card="store.findCard"
      @submit="save"
      @cancel="closeForm"
    />

    <p v-if="loading">Chargement de la collection…</p>
    <template v-else>
      <CollectionStats v-if="!isEmpty" :stats="stats" />

      <section class="entries" aria-labelledby="entries-title">
        <h2 id="entries-title" ref="listHeading" tabindex="-1">Mes cartes</h2>

        <button v-if="!form" type="button" class="add" @click="openForm({ mode: 'create' })">
          Ajouter une carte manuellement
        </button>

        <div v-if="isEmpty" class="empty">
          <p><strong>Ta collection est vide.</strong></p>
          <p>
            Pour ajouter une carte, cherche-la dans
            <RouterLink to="/">Recherche</RouterLink>
            puis choisis « Ajouter à ma collection ». Tu peux aussi la saisir manuellement avec son
            identifiant (passcode), ou importer une sauvegarde ci-dessous.
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

          <p class="count">{{ items.length }} entrée(s) affichée(s)</p>

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
          <p v-else-if="hasFilters">
            Aucune entrée ne correspond aux filtres.
            <button type="button" @click="store.resetFilters">Réinitialiser les filtres</button>
          </p>
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
  gap: 1rem;
  max-width: 60rem;
}
/* La zone reste dans la page même vide : masquée, elle ne serait plus annoncée. */
.status,
.error {
  margin: 0;
  font-weight: bold;
}
.list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 18rem), 1fr));
  gap: 0.75rem;
  padding: 0;
  margin: 0;
}
.add {
  min-height: 2.75rem;
}
</style>
