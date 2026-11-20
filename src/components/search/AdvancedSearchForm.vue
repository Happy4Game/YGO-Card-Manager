<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import LinkMarkerPicker from '@/components/search/LinkMarkerPicker.vue'
import {
  advancedFromQuery,
  applyAdvanced,
  type AdvancedChange,
  type CardCategory,
} from '@/services/search/advancedQuery'
import { NUMBER_FIELDS, type NumberField } from '@/services/search/queryParser'
import type { SearchFacets } from '@/services/search/searchEngine'
import {
  ATTRIBUTES,
  CARD_CATEGORIES,
  CARD_KINDS,
  MONSTER_RACES,
  SPELL_TRAP_RACES,
  attributeLabel,
  kindLabel,
  raceLabel,
} from '@/services/search/vocabulary'

/**
 * Mode avancé : un contrôle pour chaque élément d'une carte.
 * Le formulaire n'a pas d'état propre : il lit la saisie universelle (`query`) et la réécrit
 * (`update:query`), ce qui garde les deux synchronisés et montre la syntaxe à l'utilisateur.
 */
const props = defineProps<{ query: string; facets: SearchFacets | null }>()
const emit = defineEmits<{ 'update:query': [query: string] }>()

const state = computed(() => advancedFromQuery(props.query))

// Les champs de saisie libre gardent un brouillon local : sinon, réécrire la saisie à chaque
// touche ferait disparaître une espace finale ou un code incomplet pendant la frappe.
type DraftKey = 'name' | 'text' | 'passcode' | 'printCode' | 'archetype' | 'set' | 'rarity'
const DRAFT_KEYS: readonly DraftKey[] = [
  'name',
  'text',
  'passcode',
  'printCode',
  'archetype',
  'set',
  'rarity',
]
const drafts = reactive<Record<DraftKey, string>>({
  name: '',
  text: '',
  passcode: '',
  printCode: '',
  archetype: '',
  set: '',
  rarity: '',
})
const rangeDrafts = reactive<Record<NumberField, { min: string; max: string }>>({
  atk: { min: '', max: '' },
  def: { min: '', max: '' },
  level: { min: '', max: '' },
  link: { min: '', max: '' },
  scale: { min: '', max: '' },
})

let lastEmitted: string | null = null

function syncDrafts(): void {
  const current = state.value
  for (const key of DRAFT_KEYS) drafts[key] = current[key]
  for (const field of NUMBER_FIELDS) {
    rangeDrafts[field].min = current.ranges[field].min
    rangeDrafts[field].max = current.ranges[field].max
  }
}

// Saisie modifiée ailleurs (champ universel, puce retirée…) : on recopie dans les brouillons.
// Doc Vue : https://fr.vuejs.org/guide/essentials/watchers.html
watch(
  () => props.query,
  (query) => {
    if (query !== lastEmitted) syncDrafts()
    lastEmitted = null
  },
  { immediate: true },
)

function commit(change: AdvancedChange): void {
  const next = applyAdvanced(props.query, change)
  lastEmitted = next
  emit('update:query', next)
}

/** Valeur d'un champ texte à partir de son événement `input`, sans cast non vérifié. */
function inputValue(event: Event): string {
  const target = event.target
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement
    ? target.value
    : ''
}

function onDraft(key: DraftKey, event: Event): void {
  drafts[key] = inputValue(event)
  commit({ key, value: drafts[key] })
}

function onRange(field: NumberField, bound: 'min' | 'max', event: Event): void {
  rangeDrafts[field][bound] = inputValue(event)
  commit({ key: 'range', field, bound, value: rangeDrafts[field][bound] })
}

function isCategory(value: string): value is CardCategory {
  return CARD_CATEGORIES.some((category) => category === value)
}

function onCategory(event: Event): void {
  const value = inputValue(event)
  commit({ key: 'category', value: isCategory(value) ? value : '' })
}

function toggleKind(kind: string): void {
  const kinds = state.value.kinds.includes(kind)
    ? state.value.kinds.filter((k) => k !== kind)
    : [...state.value.kinds, kind]
  commit({ key: 'kinds', value: kinds })
}

function onOwned(event: Event): void {
  const target = event.target
  commit({ key: 'owned', value: target instanceof HTMLInputElement && target.checked })
}

// Listes proposées : valeurs réellement présentes dans les données, sinon le vocabulaire connu.
const categories: readonly string[] = CARD_CATEGORIES
const kindOptions = computed(() => {
  const fromData = props.facets?.kinds ?? []
  const values = fromData.length > 0 ? fromData : CARD_KINDS.map((k) => k.value)
  return values.filter((value) => !categories.includes(value))
})
const attributeOptions = computed(() => {
  const fromData = props.facets?.attributes ?? []
  return fromData.length > 0 ? fromData : ATTRIBUTES.map((a) => a.value)
})
const monsterRaceOptions = computed(() => {
  const fromData = props.facets?.monsterRaces ?? []
  return fromData.length > 0 ? fromData : MONSTER_RACES.map((r) => r.value)
})
const spellTrapRaceOptions = computed(() => {
  const fromData = props.facets?.spellTrapRaces ?? []
  return fromData.length > 0 ? fromData : SPELL_TRAP_RACES.map((r) => r.value)
})

const rangeFields: { field: NumberField; label: string; step: number }[] = [
  { field: 'atk', label: 'ATK', step: 50 },
  { field: 'def', label: 'DEF', step: 50 },
  { field: 'level', label: 'Niveau / Rang', step: 1 },
  { field: 'link', label: 'Classe Lien', step: 1 },
  { field: 'scale', label: 'Échelle Pendule', step: 1 },
]
</script>

<template>
  <form class="advanced" aria-label="Recherche avancée" @submit.prevent>
    <fieldset>
      <legend>Nom et texte</legend>
      <div class="grid">
        <label class="field">
          <span>Nom (français ou anglais)</span>
          <input
            :value="drafts.name"
            type="text"
            autocomplete="off"
            @input="onDraft('name', $event)"
          />
        </label>
        <label class="field">
          <span>Texte de la carte</span>
          <input
            :value="drafts.text"
            type="text"
            autocomplete="off"
            @input="onDraft('text', $event)"
          />
        </label>
        <label class="field">
          <span>Passcode</span>
          <input
            :value="drafts.passcode"
            type="text"
            inputmode="numeric"
            autocomplete="off"
            placeholder="12345678"
            @input="onDraft('passcode', $event)"
          />
        </label>
        <label class="field">
          <span>Code d'impression</span>
          <input
            :value="drafts.printCode"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            placeholder="ABC-FR001"
            @input="onDraft('printCode', $event)"
          />
        </label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Type de carte</legend>
      <div class="grid">
        <label class="field">
          <span>Catégorie</span>
          <select :value="state.category" @change="onCategory">
            <option value="">Toutes</option>
            <option v-for="category in CARD_CATEGORIES" :key="category" :value="category">
              {{ kindLabel(category) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Attribut</span>
          <select
            :value="state.attribute"
            @change="commit({ key: 'attribute', value: inputValue($event) })"
          >
            <option value="">Tous</option>
            <option v-for="value in attributeOptions" :key="value" :value="value">
              {{ attributeLabel(value) }}
            </option>
          </select>
        </label>
        <label class="field">
          <span>Type de monstre / sous-type</span>
          <select :value="state.race" @change="commit({ key: 'race', value: inputValue($event) })">
            <option value="">Tous</option>
            <optgroup label="Monstres">
              <option v-for="value in monsterRaceOptions" :key="value" :value="value">
                {{ raceLabel(value) }}
              </option>
            </optgroup>
            <optgroup label="Magies et Pièges">
              <option v-for="value in spellTrapRaceOptions" :key="`st-${value}`" :value="value">
                {{ raceLabel(value) }}
              </option>
            </optgroup>
          </select>
        </label>
        <label class="field">
          <span>Archétype</span>
          <input
            :value="drafts.archetype"
            type="text"
            list="adv-archetypes"
            autocomplete="off"
            @input="onDraft('archetype', $event)"
          />
          <datalist id="adv-archetypes">
            <option v-for="value in facets?.archetypes ?? []" :key="value" :value="value"></option>
          </datalist>
        </label>
      </div>
      <div class="kinds" role="group" aria-labelledby="adv-kinds-label">
        <p id="adv-kinds-label" class="group-label">Genres (toutes les cases choisies)</p>
        <div class="toggles">
          <button
            v-for="kind in kindOptions"
            :key="kind"
            type="button"
            class="toggle"
            :aria-pressed="state.kinds.includes(kind)"
            @click="toggleKind(kind)"
          >
            {{ kindLabel(kind) }}
          </button>
        </div>
      </div>
    </fieldset>

    <fieldset>
      <legend>Caractéristiques</legend>
      <div class="ranges">
        <div
          v-for="{ field, label, step } in rangeFields"
          :key="field"
          class="range"
          role="group"
          :aria-labelledby="`adv-${field}-label`"
        >
          <p :id="`adv-${field}-label`" class="group-label">{{ label }}</p>
          <div class="range-inputs">
            <label class="field compact">
              <span>min.</span>
              <input
                :value="rangeDrafts[field].min"
                type="number"
                inputmode="numeric"
                min="0"
                :step="step"
                @input="onRange(field, 'min', $event)"
              />
            </label>
            <label class="field compact">
              <span>max.</span>
              <input
                :value="rangeDrafts[field].max"
                type="number"
                inputmode="numeric"
                min="0"
                :step="step"
                @input="onRange(field, 'max', $event)"
              />
            </label>
          </div>
        </div>
      </div>
      <fieldset class="markers">
        <legend class="group-label">Flèches Lien (toutes exigées)</legend>
        <LinkMarkerPicker
          :model-value="state.markers"
          @update:model-value="commit({ key: 'markers', value: $event })"
        />
      </fieldset>
    </fieldset>

    <fieldset>
      <legend>Extension et collection</legend>
      <div class="grid">
        <label class="field">
          <span>Extension (code ou nom)</span>
          <input
            :value="drafts.set"
            type="text"
            list="adv-sets"
            autocomplete="off"
            autocapitalize="characters"
            @input="onDraft('set', $event)"
          />
          <datalist id="adv-sets">
            <option
              v-for="set in facets?.sets ?? []"
              :key="set.prefix"
              :value="set.prefix"
              :label="set.name"
            ></option>
          </datalist>
        </label>
        <label class="field">
          <span>Rareté</span>
          <input
            :value="drafts.rarity"
            type="text"
            list="adv-rarities"
            autocomplete="off"
            @input="onDraft('rarity', $event)"
          />
          <datalist id="adv-rarities">
            <option v-for="value in facets?.rarities ?? []" :key="value" :value="value"></option>
          </datalist>
        </label>
      </div>
      <label class="check">
        <input type="checkbox" :checked="state.owned" @change="onOwned" />
        <span>Seulement les cartes de ma collection</span>
      </label>
    </fieldset>
  </form>
</template>

<style scoped>
.advanced {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
fieldset {
  min-width: 0;
  margin: 0;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
}
legend {
  padding: 0 var(--space-1);
  font-weight: 700;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-3);
}
.field {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
input[type='text'],
input[type='number'],
select {
  box-sizing: border-box;
  width: 100%;
  min-height: 2.75rem;
  padding: var(--space-2) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-md);
}
.group-label {
  margin: 0 0 var(--space-1);
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--color-text);
}
.kinds {
  margin-top: var(--space-3);
}
.toggles {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.toggle {
  min-height: 2.25rem;
  padding: var(--space-1) var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  background: var(--color-surface);
  color: var(--color-text);
  font: inherit;
  font-size: var(--text-sm);
  cursor: pointer;
}
.toggle[aria-pressed='true'] {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.ranges {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
  gap: var(--space-3);
}
.range-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.markers {
  margin-top: var(--space-3);
  padding: 0;
  border: none;
}
.check {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  margin-top: var(--space-3);
  min-height: 2.75rem;
}
.check input {
  width: 1.25rem;
  height: 1.25rem;
  accent-color: var(--color-primary);
}
input:focus-visible,
select:focus-visible,
.toggle:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}
</style>
