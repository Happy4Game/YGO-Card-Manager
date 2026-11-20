/**
 * Pont entre le formulaire avancé et le champ universel.
 *
 * Le formulaire n'a pas d'état propre : il lit ses valeurs dans la saisie (`advancedFromQuery`)
 * et, à chaque modification, réécrit seulement les jetons qu'il « possède » (`applyAdvanced`).
 * Les autres jetons tapés à la main (exclusions, mots du texte…) sont conservés tels quels.
 * L'utilisateur voit ainsi la syntaxe correspondant à ses choix et peut l'apprendre.
 */
import { keyOf } from './normalize'
import {
  parseToken,
  quoteValue,
  tokenize,
  type ListField,
  type NumberField,
  type QueryToken,
} from './queryParser'
import {
  ATTRIBUTES,
  CARD_CATEGORIES,
  CARD_KINDS,
  LINK_MARKERS,
  RACES,
  type VocabularyEntry,
} from './vocabulary'

export type CardCategory = (typeof CARD_CATEGORIES)[number]

export interface AdvancedState {
  name: string
  text: string
  passcode: string
  printCode: string
  category: CardCategory | ''
  /** Types de monstre cochés (valeurs anglaises : Effect, XYZ, Tuner…). */
  kinds: string[]
  attribute: string
  race: string
  archetype: string
  set: string
  rarity: string
  /** Flèches Lien exigées (valeurs anglaises : Top, Bottom-Left…). */
  markers: string[]
  ranges: Record<NumberField, { min: string; max: string }>
  owned: boolean
}

export type AdvancedTextKey =
  | 'name'
  | 'text'
  | 'passcode'
  | 'printCode'
  | 'attribute'
  | 'race'
  | 'archetype'
  | 'set'
  | 'rarity'

export type AdvancedChange =
  | { key: AdvancedTextKey; value: string }
  | { key: 'category'; value: CardCategory | '' }
  | { key: 'kinds' | 'markers'; value: string[] }
  | { key: 'range'; field: NumberField; bound: 'min' | 'max'; value: string }
  | { key: 'owned'; value: boolean }

function isCategory(value: string): value is CardCategory {
  return CARD_CATEGORIES.some((category) => category === value)
}

// --- Jetons possédés par chaque contrôle ------------------------------------------

/** Un filtre simple : positif, une seule valeur, du champ demandé (pas une forme `code:`). */
function simpleFilter(token: QueryToken, field: ListField | 'name' | 'text') {
  if (token.kind !== 'field' || token.negate || token.filter.field !== field) return undefined
  if (token.origin === 'code' || token.filter.values.length !== 1) return undefined
  return token.filter.values[0]
}

type Owner = (token: QueryToken) => boolean

function ownerOf(change: AdvancedChange): Owner {
  switch (change.key) {
    case 'name':
      return (t) => (t.kind === 'word' || t.kind === 'phrase') && !t.negate
    case 'text':
      return (t) => simpleFilter(t, 'text') !== undefined
    case 'passcode':
      return (t) => t.kind === 'id' && !t.negate
    case 'printCode':
      return (t) =>
        (t.kind === 'code' && !t.negate) || (t.kind === 'field' && !t.negate && t.origin === 'code')
    case 'category':
      return (t) => {
        const value = simpleFilter(t, 'type')
        return value !== undefined && value.exact && isCategory(value.value)
      }
    case 'kinds':
      return (t) => {
        const value = simpleFilter(t, 'type')
        return value !== undefined && value.exact && !isCategory(value.value)
      }
    case 'attribute':
      return (t) => simpleFilter(t, 'attr') !== undefined
    case 'race':
      return (t) => simpleFilter(t, 'race') !== undefined
    case 'archetype':
      return (t) => simpleFilter(t, 'arch') !== undefined
    case 'set':
      return (t) => simpleFilter(t, 'set') !== undefined
    case 'rarity':
      return (t) => simpleFilter(t, 'rarity') !== undefined
    case 'markers':
      return (t) =>
        t.kind === 'field' &&
        !t.negate &&
        t.filter.field === 'marker' &&
        t.filter.values.every((v) => v.exact)
    case 'range':
      return (t) => t.kind === 'range' && t.field === change.field
    case 'owned':
      return (t) => t.kind === 'owned' && !t.negate
  }
}

// --- Lecture : saisie → formulaire ---------------------------------------------------

function emptyRanges(): AdvancedState['ranges'] {
  return {
    atk: { min: '', max: '' },
    def: { min: '', max: '' },
    level: { min: '', max: '' },
    link: { min: '', max: '' },
    scale: { min: '', max: '' },
  }
}

export function emptyAdvancedState(): AdvancedState {
  return {
    name: '',
    text: '',
    passcode: '',
    printCode: '',
    category: '',
    kinds: [],
    attribute: '',
    race: '',
    archetype: '',
    set: '',
    rarity: '',
    markers: [],
    ranges: emptyRanges(),
    owned: false,
  }
}

/** Valeurs du formulaire avancé déduites de la saisie (ce qui n'est pas représentable est ignoré). */
export function advancedFromQuery(input: string): AdvancedState {
  const state = emptyAdvancedState()
  const tokens = tokenize(input)
  const parsed = tokens.map(parseToken)
  const names: string[] = []
  const texts: string[] = []
  const ids: string[] = []
  const codes: string[] = []

  parsed.forEach((token, index) => {
    const raw = tokens[index] ?? ''
    if ((token.kind === 'word' || token.kind === 'phrase') && !token.negate) names.push(raw)
    if (token.kind === 'id' && !token.negate) ids.push(String(token.value))
    if (token.kind === 'code' && !token.negate) codes.push(raw.replace(/^[^:]*:/, '').toUpperCase())
    if (token.kind === 'field' && !token.negate && token.origin === 'code') {
      codes.push(token.filter.values[0]?.label ?? '')
    }
    if (token.kind === 'owned' && !token.negate) state.owned = true
    if (token.kind === 'range') {
      const current = state.ranges[token.field]
      if (token.range.min !== undefined) current.min = String(token.range.min)
      if (token.range.max !== undefined) current.max = String(token.range.max)
    }
    if (token.kind === 'field' && !token.negate && token.filter.field === 'marker') {
      for (const v of token.filter.values)
        if (!state.markers.includes(v.value)) state.markers.push(v.value)
    }
    const text = simpleFilter(token, 'text')
    if (text) texts.push(text.label)
    const type = simpleFilter(token, 'type')
    if (type?.exact) {
      if (isCategory(type.value)) state.category = type.value
      else if (!state.kinds.includes(type.value)) state.kinds.push(type.value)
    }
    const attr = simpleFilter(token, 'attr')
    if (attr) state.attribute = attr.value
    const race = simpleFilter(token, 'race')
    if (race) state.race = race.exact ? race.value : race.label
    const arch = simpleFilter(token, 'arch')
    if (arch) state.archetype = arch.label
    const set = simpleFilter(token, 'set')
    if (set) state.set = set.label
    const rarity = simpleFilter(token, 'rarity')
    if (rarity) state.rarity = rarity.label
  })

  state.name = names.join(' ')
  state.text = texts.join(' ')
  state.passcode = ids.join(' ')
  state.printCode = codes.join(' ')
  return state
}

// --- Écriture : formulaire → saisie ----------------------------------------------------

/** Alias français le plus lisible d'une valeur du vocabulaire (« Spellcaster » → « magicien »). */
function frenchAlias(entries: readonly VocabularyEntry[], value: string): string {
  const entry = entries.find((candidate) => candidate.value === value)
  return entry ? keyOf(entry.label) : quoteValue(value)
}

function rangeToken(field: NumberField, min: string, max: string): string[] {
  const name = { atk: 'atk', def: 'def', level: 'niv', link: 'lien', scale: 'echelle' }[field]
  const low = /^\d+$/.test(min.trim()) ? min.trim() : ''
  const high = /^\d+$/.test(max.trim()) ? max.trim() : ''
  if (low !== '' && high !== '') return [low === high ? `${name}:${low}` : `${name}:${low}-${high}`]
  if (low !== '') return [`${name}>=${low}`]
  if (high !== '') return [`${name}<=${high}`]
  return []
}

/** Le texte du nom peut contenir des mots qui ressemblent à des filtres : on les protège. */
function freeTextTokens(value: string): string[] {
  return tokenize(value).map((raw) => {
    const token = parseToken(raw)
    const isFree = (token.kind === 'word' && !raw.includes(':')) || token.kind === 'phrase'
    return isFree && !token.negate ? raw : `"${raw.replace(/"/g, '')}"`
  })
}

function serialize(change: AdvancedChange, input: string): string[] {
  switch (change.key) {
    case 'name':
      return freeTextTokens(change.value)
    case 'text':
      return change.value.trim() === '' ? [] : [`texte:${quoteValue(change.value)}`]
    case 'passcode':
      return change.value
        .split(/[\s,]+/)
        .filter((id) => /^\d{1,9}$/.test(id))
        .map((id) => `#${id}`)
    case 'printCode':
      return change.value
        .split(/[\s,]+/)
        .filter((code) => code !== '')
        .map((code) =>
          /^[A-Z0-9]{2,5}-[A-Z]{0,2}\d{3}$/i.test(code)
            ? code.toUpperCase()
            : `code:${code.toUpperCase()}`,
        )
    case 'category':
      return change.value === '' ? [] : [`type:${frenchAlias(CARD_KINDS, change.value)}`]
    case 'kinds':
      return change.value.map((kind) => `type:${frenchAlias(CARD_KINDS, kind)}`)
    case 'attribute':
      return change.value === '' ? [] : [`attr:${frenchAlias(ATTRIBUTES, change.value)}`]
    case 'race':
      return change.value === '' ? [] : [`race:${frenchAlias(RACES, change.value)}`]
    case 'archetype':
      return change.value.trim() === '' ? [] : [`arch:${quoteValue(change.value)}`]
    case 'set':
      return change.value.trim() === '' ? [] : [`set:${quoteValue(change.value)}`]
    case 'rarity':
      return change.value.trim() === '' ? [] : [`rarete:${quoteValue(change.value)}`]
    case 'markers': {
      const ordered = LINK_MARKERS.filter((m) => change.value.includes(m.value))
      return ordered.length === 0 ? [] : [`fleche:${ordered.map((m) => keyOf(m.label)).join(',')}`]
    }
    case 'range': {
      const current = advancedFromQuery(input).ranges[change.field]
      const next = { ...current, [change.bound]: change.value }
      return rangeToken(change.field, next.min, next.max)
    }
    case 'owned':
      return change.value ? ['in:collection'] : []
  }
}

/**
 * Applique une modification du formulaire à la saisie : les jetons possédés par le contrôle
 * sont remplacés (à la place du premier d'entre eux, sinon en fin de saisie).
 */
export function applyAdvanced(input: string, change: AdvancedChange): string {
  const owns = ownerOf(change)
  const replacement = serialize(change, input)
  const tokens = tokenize(input)
  const result: string[] = []
  let inserted = false
  for (const raw of tokens) {
    if (owns(parseToken(raw))) {
      if (!inserted) result.push(...replacement)
      inserted = true
    } else {
      result.push(raw)
    }
  }
  if (!inserted) {
    // Le nom (texte libre) se place en tête, les filtres à la suite.
    if (change.key === 'name') result.unshift(...replacement)
    else result.push(...replacement)
  }
  return result.join(' ')
}
