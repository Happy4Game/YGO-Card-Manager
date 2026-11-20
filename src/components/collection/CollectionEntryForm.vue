<script setup lang="ts">
import { computed, onMounted, reactive, ref, useId, useTemplateRef, watch } from 'vue'
import type { CardData } from '@/domain/card'
import { CARD_CONDITIONS } from '@/domain/collection'
import {
  COLLECTION_LANGUAGES,
  fallbackCardName,
  type CollectionItem,
  type NewCollectionEntry,
} from '@/services/collection'
import { CONDITION_LABELS } from './labels'
import PrintFields from '@/components/common/PrintFields.vue'
import { pickPrint, readDefaults } from '@/services/quickAdd'
import { isSetCode } from '@/domain/setCode'

const props = defineProps<{
  /** Entrée à modifier ; absente pour un ajout. */
  entry?: CollectionItem
  /** Carte pré-sélectionnée (lien « Ajouter à ma collection » depuis la recherche). */
  initialCardId?: number
  /** Code d'impression pré-rempli (ex. lu par le scan), utilisé seulement pour un ajout. */
  initialSetCode?: string
  /** Emplacements existants, proposés en autocomplétion. */
  locations: string[]
  /** Recherche d'une carte dans le cache local. */
  findCard: (cardId: number) => Promise<CardData | undefined>
}>()

const emit = defineEmits<{ submit: [entry: NewCollectionEntry]; cancel: [] }>()

const isEdit = computed(() => props.entry !== undefined)
// `useId` génère des identifiants uniques et stables pour relier <label for> et champs.
// Doc : https://vuejs.org/api/composition-api-helpers.html#useid
const uid = useId()
const fieldId = (name: string) => `${uid}-${name}`

/** Pour un ajout : derniers réglages utilisés (langue, état, emplacement). */
const defaults = props.entry ? undefined : readDefaults()

const draft = reactive({
  // Champ texte : un <input type="number"> vide ne vaut pas un nombre, on convertit à l'envoi.
  cardId: String(props.entry?.cardId ?? props.initialCardId ?? ''),
  setCode: props.entry?.setCode ?? props.initialSetCode ?? '',
  rarity: props.entry?.rarity ?? '',
  language: props.entry?.language ?? defaults?.language ?? 'fr',
  condition: props.entry?.condition ?? defaults?.condition ?? 'Near Mint',
  quantity: props.entry?.quantity ?? 1,
  location: props.entry?.location ?? defaults?.location ?? '',
  note: props.entry?.note ?? '',
})

const parsedCardId = computed(() => {
  const value = Number(draft.cardId)
  return Number.isInteger(value) && value > 0 ? value : undefined
})

const card = ref<CardData>()

// Recherche la carte dans le cache local quand l'identifiant change.
watch(
  parsedCardId,
  async (cardId) => {
    const found = cardId === undefined ? undefined : await props.findCard(cardId)
    // Ignore une réponse arrivée après une nouvelle saisie.
    if (cardId !== parsedCardId.value) return
    card.value = found
    // Ajout : impression déduite du code lu, ou la seule impression connue.
    if (found && !isEdit.value && draft.rarity === '') {
      const print = pickPrint(found, draft.setCode || undefined)
      draft.setCode = print.code
      draft.rarity = print.rarity
    }
  },
  { immediate: true },
)

const cardHint = computed(() => {
  if (parsedCardId.value === undefined) {
    return 'Le numéro à 8 chiffres imprimé en bas à gauche de la carte.'
  }
  if (card.value) return `Carte : ${card.value.name}`
  return `${fallbackCardName(parsedCardId.value)} : nom inconnu, les données des cartes ne sont pas encore téléchargées.`
})
const knownSets = computed(() => card.value?.sets ?? [])

const errorMessage = ref('')
const codeError = ref('')

function submit() {
  const cardId = parsedCardId.value
  if (cardId === undefined) {
    errorMessage.value = "Indique l'identifiant de la carte (nombre entier positif)."
    return
  }
  // Ajout : le code de la carte est demandé (il identifie l'impression et sa rareté).
  // Modification : une ancienne entrée sans code reste modifiable.
  const code = draft.setCode.trim()
  if ((!isEdit.value || code !== '') && !isSetCode(code)) {
    codeError.value = code === '' ? 'Indique le code imprimé sur la carte (ex. LOB-FR001).' : ''
    errorMessage.value = 'Vérifie le code de la carte.'
    return
  }
  codeError.value = ''
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1) {
    errorMessage.value = 'La quantité doit être un entier supérieur ou égal à 1.'
    return
  }
  errorMessage.value = ''
  emit('submit', {
    cardId,
    setCode: code,
    rarity: draft.rarity.trim(),
    language: draft.language,
    condition: draft.condition,
    quantity: draft.quantity,
    location: draft.location,
    note: draft.note,
  })
}

// À l'ouverture, le focus va sur le titre du formulaire : le lecteur d'écran annonce le contexte.
const heading = useTemplateRef<HTMLHeadingElement>('heading')
onMounted(() => heading.value?.focus())
</script>

<template>
  <form
    class="entry-form surface"
    :aria-labelledby="fieldId('title')"
    novalidate
    @submit.prevent="submit"
  >
    <h2 :id="fieldId('title')" ref="heading" class="entry-form__title" tabindex="-1">
      {{ isEdit ? 'Modifier une entrée' : 'Ajouter une carte' }}
    </h2>

    <div class="field field--wide">
      <label :for="fieldId('card')">Identifiant de la carte (passcode)</label>
      <input
        :id="fieldId('card')"
        v-model="draft.cardId"
        type="text"
        inputmode="numeric"
        pattern="[0-9]*"
        required
        :readonly="isEdit"
        :aria-describedby="fieldId('card-name')"
      />
      <p :id="fieldId('card-name')" class="hint" :class="{ 'hint--found': card }">
        {{ cardHint }}
      </p>
    </div>

    <PrintFields
      v-model:code="draft.setCode"
      v-model:rarity="draft.rarity"
      :sets="knownSets"
      :id-prefix="fieldId('print')"
      :code-error="codeError"
    />

    <div class="field">
      <label :for="fieldId('language')">Langue</label>
      <select :id="fieldId('language')" v-model="draft.language">
        <option
          v-for="language in COLLECTION_LANGUAGES"
          :key="language.code"
          :value="language.code"
        >
          {{ language.label }}
        </option>
      </select>
    </div>

    <div class="field">
      <label :for="fieldId('condition')">État</label>
      <select :id="fieldId('condition')" v-model="draft.condition">
        <option v-for="condition in CARD_CONDITIONS" :key="condition" :value="condition">
          {{ CONDITION_LABELS[condition] }}
        </option>
      </select>
    </div>

    <div class="field">
      <label :for="fieldId('quantity')">Quantité</label>
      <input
        :id="fieldId('quantity')"
        v-model.number="draft.quantity"
        type="number"
        inputmode="numeric"
        min="1"
        step="1"
        required
      />
    </div>

    <div class="field">
      <label :for="fieldId('location')">Emplacement</label>
      <!-- <datalist> propose les emplacements existants sans empêcher d'en saisir un nouveau.
           Doc : https://developer.mozilla.org/fr/docs/Web/HTML/Element/datalist -->
      <input
        :id="fieldId('location')"
        v-model="draft.location"
        type="text"
        autocomplete="off"
        :list="fieldId('locations')"
        placeholder="ex. Classeur bleu"
      />
      <datalist :id="fieldId('locations')">
        <option v-for="location in locations" :key="location" :value="location" />
      </datalist>
    </div>

    <div class="field field--wide">
      <label :for="fieldId('note')">Note</label>
      <textarea :id="fieldId('note')" v-model="draft.note" rows="2" />
    </div>

    <p v-if="errorMessage" class="notice notice--danger field--wide" role="alert">
      {{ errorMessage }}
    </p>

    <div class="actions field--wide">
      <button type="submit" class="btn--primary">Enregistrer</button>
      <button type="button" class="btn--ghost" @click="emit('cancel')">Annuler</button>
    </div>
  </form>
</template>

<style scoped>
.entry-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-4);
  border-color: color-mix(in srgb, var(--color-primary) 35%, var(--color-border));
  box-shadow: var(--shadow-md);
}

.field--wide {
  grid-column: 1 / -1;
}

.entry-form__title {
  grid-column: 1 / -1;
}

.hint {
  overflow-wrap: anywhere;
}

.hint--found {
  color: var(--color-success);
  font-weight: 600;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

@media (max-width: 30rem) {
  .actions button {
    flex: 1 1 100%;
  }
}
</style>
