<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef, watch } from 'vue'
import { db } from '@/db/database'
import type { CardSet } from '@/domain/card'
import { isSetCode, setCodeKey } from '@/domain/setCode'
import { listRarities } from '@/services/rarities'

/**
 * Code d'impression + rareté, partagés par le formulaire d'ajout et l'ajout rapide.
 * Le code (ex. « LOB-FR001 ») est imprimé sous l'illustration, à droite. Dès qu'il
 * correspond à une impression connue de la carte, sa rareté est proposée en premier.
 */
const props = defineProps<{
  /** Impressions connues de la carte (vide si les données ne sont pas téléchargées). */
  sets: CardSet[]
  /** Préfixe des identifiants HTML (unique dans la page). */
  idPrefix: string
  /** Erreur affichée sous le code (ex. code manquant à l'envoi). */
  codeError?: string
}>()

const code = defineModel<string>('code', { required: true })
const rarity = defineModel<string>('rarity', { required: true })

const fieldId = (name: string) => `${props.idPrefix}-${name}`

/** Raretés déjà existantes (cartes téléchargées + collection), lues à l'affichage. */
const allRarities = ref<string[]>([])
onMounted(async () => {
  allRarities.value = await listRarities(db)
})

/** Saisie en majuscules, comme sur la carte. */
const codeInput = computed({
  get: () => code.value,
  set: (value: string) => {
    code.value = value.toUpperCase()
  },
})

const formatError = computed(() =>
  code.value.trim() !== '' && !isSetCode(code.value)
    ? 'Format attendu : le code du set, un tiret, la langue puis 3 chiffres (ex. LOB-FR001, MP23-FR045).'
    : '',
)
// L'erreur du parent (« code manquant ») disparaît dès qu'on commence à le saisir.
const error = computed(
  () => formatError.value || (code.value.trim() === '' ? (props.codeError ?? '') : ''),
)

/** Impressions dont le code correspond, sans tenir compte de la langue (FR, EN…). */
const matchingSets = computed(() => {
  const key = setCodeKey(code.value)
  return key ? props.sets.filter((set) => setCodeKey(set.code) === key) : []
})
const knownCodes = computed(() => [...new Set(props.sets.map((set) => set.code))])

const OTHER_RARITY = '__other__'
const rarityFree = ref(false)
/** Raretés de cette impression, ou de toutes les impressions de la carte si le code est inconnu. */
const cardRarities = computed(() => {
  const source = matchingSets.value.length > 0 ? matchingSets.value : props.sets
  return [...new Set(source.map((set) => set.rarity).filter(Boolean))]
})
const otherRarities = computed(() => {
  const list = allRarities.value.filter((item) => !cardRarities.value.includes(item))
  // Une rareté saisie auparavant reste sélectionnable même si elle n'est plus connue.
  const current = rarity.value.trim()
  if (current && !cardRarities.value.includes(current) && !list.includes(current)) {
    list.unshift(current)
  }
  return list
})
const rarityChoice = computed({
  get: () => (rarityFree.value ? OTHER_RARITY : rarity.value),
  set: (value: string) => {
    rarityFree.value = value === OTHER_RARITY
    if (!rarityFree.value) rarity.value = value
  },
})

// Un code reconnu propose sa rareté (sauf si la rareté choisie est déjà l'une des siennes).
watch(code, () => {
  const match = matchingSets.value
  if (match.length > 0 && !match.some((set) => set.rarity === rarity.value)) {
    rarity.value = match[0]?.rarity ?? ''
    rarityFree.value = false
  }
})

const codeField = useTemplateRef<HTMLInputElement>('codeField')
defineExpose({ focusCode: () => codeField.value?.focus() })
</script>

<template>
  <div class="field">
    <label :for="fieldId('code')">Code de la carte</label>
    <!-- <datalist> propose les codes connus sans empêcher d'en saisir un autre.
         Doc : https://developer.mozilla.org/fr/docs/Web/HTML/Element/datalist -->
    <input
      :id="fieldId('code')"
      ref="codeField"
      v-model.trim="codeInput"
      type="text"
      required
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
      enterkeyhint="done"
      placeholder="ex. LOB-FR001"
      :list="knownCodes.length > 0 ? fieldId('codes') : undefined"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="fieldId('code-hint')"
    />
    <datalist v-if="knownCodes.length > 0" :id="fieldId('codes')">
      <option v-for="item in knownCodes" :key="item" :value="item" />
    </datalist>
    <p :id="fieldId('code-hint')" class="hint" :class="{ 'hint--error': error }">
      <template v-if="error">{{ error }}</template>
      <template v-else-if="matchingSets[0]">{{ matchingSets[0].name }}</template>
      <template v-else>Imprimé sous l'illustration, à droite.</template>
    </p>
  </div>

  <div class="field">
    <label :for="fieldId('rarity-choice')">Rareté</label>
    <!-- <optgroup> regroupe les options sous un titre lu par les lecteurs d'écran.
         Doc : https://developer.mozilla.org/fr/docs/Web/HTML/Element/optgroup -->
    <select :id="fieldId('rarity-choice')" v-model="rarityChoice">
      <option value="">Non précisée</option>
      <optgroup v-if="cardRarities.length > 0" label="Raretés de cette carte">
        <option v-for="item in cardRarities" :key="item" :value="item">{{ item }}</option>
      </optgroup>
      <optgroup v-if="otherRarities.length > 0" label="Toutes les raretés">
        <option v-for="item in otherRarities" :key="item" :value="item">{{ item }}</option>
      </optgroup>
      <option :value="OTHER_RARITY">Autre (saisie libre)…</option>
    </select>
  </div>

  <div v-if="rarityFree" class="field">
    <label :for="fieldId('rarity')">Nouvelle rareté</label>
    <input
      :id="fieldId('rarity')"
      v-model="rarity"
      type="text"
      autocomplete="off"
      placeholder="ex. Starlight Rare"
    />
  </div>
</template>

<style scoped>
.hint {
  overflow-wrap: anywhere;
}
.hint--error {
  color: var(--color-danger);
  font-weight: 600;
}
</style>
