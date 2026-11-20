/**
 * Analyseur de la recherche universelle : un seul champ qui accepte « n'importe quoi ».
 *
 * La saisie est découpée en morceaux (« jetons ») séparés par des espaces ; un jeton entre
 * guillemets peut contenir des espaces. Chaque jeton est reconnu comme :
 * - un mot libre (`dragon`) ou une expression exacte (`"dragon blanc"`), éventuellement exclu (`-blanc`) ;
 * - un passcode (`12345678`, `#1234`) ou un code d'impression (`LOB-FR001`) ;
 * - un filtre `champ:valeur` ou une comparaison (`atk>=2500`, `niv:4-8`).
 *
 * Fonctions pures : jamais d'exception, toute saisie inconnue produit un avertissement lisible.
 */
import { setCodeKey } from '@/domain/setCode'
import { keyOf, normalizeWords } from './normalize'
import { RARITY_WORDS, findAttribute, findKind, findMarker, findRace } from './vocabulary'

export type TextField = 'name' | 'en' | 'text'
export type ListField = 'type' | 'attr' | 'race' | 'arch' | 'set' | 'rarity' | 'marker'
export type NumberField = 'atk' | 'def' | 'level' | 'link' | 'scale'

/** Une valeur de filtre ; `exact` : reconnue dans le vocabulaire (valeur anglaise des données). */
export interface FilterValue {
  value: string
  exact: boolean
  label: string
}

export interface FieldFilter {
  field: TextField | ListField
  /** Valeurs alternatives (OU), sauf pour les flèches Lien où toutes sont exigées. */
  values: FilterValue[]
  negate: boolean
}

export interface NumberRange {
  min?: number
  max?: number
}

/** Requête structurée, prête à être exécutée par le moteur de recherche. */
export interface SearchQuery {
  /** Mots libres normalisés : chacun doit apparaître dans le nom (FR ou EN) ou le texte. */
  words: string[]
  /** Expressions exactes normalisées. */
  phrases: string[]
  /** Mots ou expressions à exclure. */
  excluded: string[]
  /** Texte libre complet (mots + expressions), pour le classement par pertinence. */
  freeText: string
  /** Passcodes recherchés (OU entre eux et avec `codes`). */
  ids: number[]
  /** Clés de codes d'impression sans région, ex. « LOB-001 ». */
  codes: string[]
  /** Régions tapées avec ces codes (« FR » pour LOB-FR001), pour proposer la bonne impression. */
  regions: string[]
  filters: FieldFilter[]
  ranges: Partial<Record<NumberField, NumberRange>>
  ownedOnly: boolean
}

interface TokenBase {
  raw: string
  negate: boolean
}

export type QueryToken =
  | (TokenBase & { kind: 'word'; value: string })
  | (TokenBase & { kind: 'phrase'; value: string })
  | (TokenBase & { kind: 'id'; value: number })
  | (TokenBase & { kind: 'code'; value: string; region: string })
  | (TokenBase & { kind: 'field'; filter: FieldFilter; origin: string })
  | (TokenBase & { kind: 'range'; field: NumberField; range: NumberRange })
  | (TokenBase & { kind: 'owned' })
  | (TokenBase & { kind: 'ignored'; message?: string })

export interface QueryChip {
  /** Position du jeton dans la saisie, pour pouvoir le retirer. */
  tokenIndex: number
  label: string
  negate: boolean
}

export interface ParsedQuery {
  query: SearchQuery
  tokens: QueryToken[]
  chips: QueryChip[]
  warnings: string[]
  /** Vrai si aucun critère n'a été compris (on affiche alors toutes les cartes). */
  isEmpty: boolean
}

// --- Champs reconnus ------------------------------------------------------------

type FieldKey = TextField | ListField | NumberField | 'id' | 'code' | 'in'

export const NUMBER_FIELDS: readonly NumberField[] = ['atk', 'def', 'level', 'link', 'scale']

/** Alias acceptés pour chaque champ (comparés après `keyOf` : sans accents ni majuscules). */
const FIELD_ALIASES: readonly (readonly [FieldKey, readonly string[]])[] = [
  ['name', ['nom', 'name', 'n']],
  ['en', ['en', 'anglais', 'english', 'nom-en', 'nomen']],
  ['text', ['texte', 'text', 'desc', 'description']],
  ['type', ['type', 'genre', 'kind']],
  ['attr', ['attr', 'attribut', 'attribute']],
  ['race', ['race', 'espece', 'especes', 'sous-type', 'soustype', 'subtype']],
  ['arch', ['arch', 'archetype']],
  ['set', ['set', 'extension', 'ext', 'serie', 'edition', 'booster']],
  ['code', ['code', 'print', 'impression']],
  ['rarity', ['rarete', 'rarity', 'rar']],
  ['marker', ['fleche', 'fleches', 'marker', 'markers', 'lm']],
  ['atk', ['atk', 'att', 'attaque', 'attack']],
  ['def', ['def', 'defense']],
  ['level', ['niv', 'niveau', 'level', 'lv', 'lvl', 'rang', 'rank', 'etoile', 'etoiles']],
  ['link', ['lien', 'link', 'lk']],
  ['scale', ['echelle', 'scale', 'ech', 'sc']],
  ['id', ['id', 'passcode']],
  ['in', ['in', 'dans']],
]

const FIELD_LOOKUP = new Map<string, FieldKey>(
  FIELD_ALIASES.flatMap(([field, aliases]) => aliases.map((alias) => [alias, field] as const)),
)

function isNumberField(field: FieldKey): field is NumberField {
  return NUMBER_FIELDS.some((candidate) => candidate === field)
}

/** Libellés français des champs, pour les puces et le formulaire avancé. */
export const FIELD_LABELS: Readonly<Record<TextField | ListField | NumberField, string>> = {
  name: 'Nom',
  en: 'Nom anglais',
  text: 'Texte',
  type: 'Type',
  attr: 'Attribut',
  race: 'Type de monstre / sous-type',
  arch: 'Archétype',
  set: 'Extension',
  rarity: 'Rareté',
  marker: 'Flèches Lien',
  atk: 'ATK',
  def: 'DEF',
  level: 'Niveau/Rang',
  link: 'Lien',
  scale: 'Échelle',
}

const OWNED_VALUES = new Set(['collection', 'col', 'coll', 'possedees', 'possedes', 'owned', 'moi'])
const OWNED_WORDS = new Set(['possedees', 'possedes'])

// --- Découpage -------------------------------------------------------------------

/**
 * Découpe la saisie en jetons bruts : les espaces séparent, sauf entre guillemets.
 * `atk>=2500 arch:"Héros Élémentaire" -"mot exclu"` → 3 jetons.
 */
export function tokenize(input: string): string[] {
  const tokens: string[] = []
  let current = ''
  let inQuotes = false
  for (const char of input) {
    if (char === '"') inQuotes = !inQuotes
    if (!inQuotes && /\s/.test(char)) {
      if (current !== '') tokens.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current !== '') tokens.push(current)
  return tokens
}

/** Retire les guillemets entourant une valeur (le guillemet fermant est facultatif). */
function unquote(text: string): { value: string; quoted: boolean } {
  if (!text.startsWith('"')) return { value: text, quoted: false }
  const inner = text.endsWith('"') && text.length > 1 ? text.slice(1, -1) : text.slice(1)
  return { value: inner.replace(/"/g, ''), quoted: true }
}

/** Ajoute des guillemets si la valeur contient des espaces (pour réécrire la saisie). */
export function quoteValue(value: string): string {
  const clean = value.replace(/"/g, '').trim()
  return /\s/.test(clean) || clean === '' ? `"${clean}"` : clean
}

// --- Interprétation d'un jeton ----------------------------------------------------

const FIELD_TOKEN = /^(\p{L}[\p{L}-]*?)(>=|<=|!=|:|>|<|=)(.*)$/su
const FULL_SET_CODE = /^[A-Z0-9]{2,5}-[A-Z]{0,2}\d{3}$/i
const ID_TOKEN = /^(?:#(\d{1,9})|(\d{8}))$/

function parseInteger(text: string): number | undefined {
  return /^\d{1,6}$/.test(text) ? Number(text) : undefined
}

/** Interprète la partie numérique d'un filtre : `2500`, `>=2500`, `4-8`, `4..8`, `4+`. */
function parseRange(operator: string, rawValue: string): NumberRange | undefined {
  let op = operator
  let value = rawValue.trim()
  if (op === ':' || op === '=') {
    const inner = /^(>=|<=|>|<|=)(.*)$/.exec(value)
    if (inner) {
      op = inner[1] ?? ':'
      value = inner[2] ?? ''
    }
  }
  if (op === ':' || op === '=') {
    const between = /^(\d{1,6})\s*(?:-|\.\.)\s*(\d{1,6})$/.exec(value)
    if (between) {
      const a = Number(between[1])
      const b = Number(between[2])
      return { min: Math.min(a, b), max: Math.max(a, b) }
    }
    const plus = /^(\d{1,6})\+$/.exec(value)
    if (plus) return { min: Number(plus[1]) }
    const exact = parseInteger(value)
    return exact === undefined ? undefined : { min: exact, max: exact }
  }
  const number = parseInteger(value)
  if (number === undefined) return undefined
  switch (op) {
    case '>=':
      return { min: number }
    case '>':
      return { min: number + 1 }
    case '<=':
      return { max: number }
    case '<':
      return { max: number - 1 }
    default:
      return undefined // « != » n'est pas pris en charge
  }
}

function resolveValue(field: ListField, text: string): FilterValue | string {
  const label = text.trim()
  switch (field) {
    case 'type': {
      const kind = findKind(label)
      if (kind) return { value: kind.value, exact: true, label: kind.label }
      // « type:dragon », « type:guerrier » : beaucoup pensent « type de monstre » (champ race).
      const race = findRace(label)
      if (race) return { value: normalizeWords(race.value), exact: false, label: race.label }
      return { value: normalizeWords(label), exact: false, label }
    }
    case 'attr': {
      const attribute = findAttribute(label)
      return attribute
        ? { value: attribute.value, exact: true, label: attribute.label }
        : `Attribut inconnu : « ${label} » (essaie lumière, ténèbres, eau, feu, terre, vent, divin).`
    }
    case 'race': {
      const race = findRace(label)
      return race
        ? { value: race.value, exact: true, label: race.label }
        : { value: normalizeWords(label), exact: false, label }
    }
    case 'marker': {
      const marker = findMarker(label)
      return marker
        ? { value: marker.value, exact: true, label: marker.label }
        : `Flèche inconnue : « ${label} » (haut, bas, gauche, droite, haut-gauche…).`
    }
    case 'rarity': {
      const words = normalizeWords(label)
        .split(' ')
        .map((word) => RARITY_WORDS[word] ?? word)
        .join(' ')
      return { value: words, exact: false, label }
    }
    case 'set':
      return { value: label, exact: false, label: label.toUpperCase() }
    case 'arch':
      return { value: normalizeWords(label), exact: false, label }
  }
}

function parseFieldToken(
  raw: string,
  negate: boolean,
  field: FieldKey,
  aliasKey: string,
  operator: string,
  rawValue: string,
): QueryToken {
  const { value, quoted } = unquote(rawValue)
  if (value.trim() === '') {
    return { kind: 'ignored', raw, negate, message: `Valeur manquante après « ${aliasKey}: ».` }
  }

  if (isNumberField(field)) {
    if (negate) {
      return {
        kind: 'ignored',
        raw,
        negate,
        message: `L'exclusion n'est pas possible sur ${FIELD_LABELS[field]} : utilise < ou >.`,
      }
    }
    const range = parseRange(operator, value)
    return range
      ? { kind: 'range', raw, negate, field, range }
      : {
          kind: 'ignored',
          raw,
          negate,
          message: `Valeur ignorée pour ${FIELD_LABELS[field]} : « ${value} » (attendu un nombre, ex. ${aliasKey}>=2000 ou ${aliasKey}:4-8).`,
        }
  }

  if (operator !== ':' && operator !== '=') {
    return {
      kind: 'ignored',
      raw,
      negate,
      message: `« ${operator} » ne s'utilise qu'avec un nombre (ATK, DEF, niveau…).`,
    }
  }

  if (field === 'in') {
    return OWNED_VALUES.has(keyOf(value))
      ? { kind: 'owned', raw, negate }
      : { kind: 'ignored', raw, negate, message: `« in:${value} » : seul in:collection existe.` }
  }

  if (field === 'id') {
    const id = /^#?(\d{1,9})$/.exec(value.trim())
    return id
      ? { kind: 'id', raw, negate, value: Number(id[1]) }
      : { kind: 'ignored', raw, negate, message: `Passcode invalide : « ${value} ».` }
  }

  if (field === 'code') {
    const key = FULL_SET_CODE.test(value.trim()) ? setCodeKey(value) : undefined
    if (key !== undefined) {
      const region = /-([A-Z]{0,2})\d{3}$/i.exec(value.trim())?.[1]?.toUpperCase() ?? ''
      return { kind: 'code', raw, negate, value: key, region }
    }
    // Code partiel (« LOB », « LOB-FR0 ») : on cherche par préfixe d'extension.
    const prefix: FilterValue = { value: value.trim(), exact: false, label: value.toUpperCase() }
    return {
      kind: 'field',
      raw,
      negate,
      origin: 'code',
      filter: { field: 'set', values: [prefix], negate },
    }
  }

  if (field === 'name' || field === 'en' || field === 'text') {
    const words = normalizeWords(value)
    if (words === '') return { kind: 'ignored', raw, negate }
    const filter: FieldFilter = {
      field,
      values: [{ value: words, exact: false, label: value }],
      negate,
    }
    return { kind: 'field', raw, negate, origin: field, filter }
  }

  // Listes : plusieurs valeurs séparées par des virgules (sauf entre guillemets).
  const parts = quoted ? [value] : value.split(',').filter((part) => part.trim() !== '')
  const values: FilterValue[] = []
  for (const part of parts) {
    const resolved = resolveValue(field, part)
    if (typeof resolved === 'string') return { kind: 'ignored', raw, negate, message: resolved }
    values.push(resolved)
  }
  if (values.length === 0) return { kind: 'ignored', raw, negate }
  return { kind: 'field', raw, negate, origin: field, filter: { field, values, negate } }
}

/** Interprète un jeton brut (sans jamais lever d'exception). */
export function parseToken(raw: string): QueryToken {
  const negate = raw.length > 1 && raw.startsWith('-')
  const body = negate ? raw.slice(1) : raw

  if (body.startsWith('"')) {
    const value = normalizeWords(unquote(body).value)
    return value === '' ? { kind: 'ignored', raw, negate } : { kind: 'phrase', raw, negate, value }
  }

  const field = FIELD_TOKEN.exec(body)
  if (field) {
    const [, name = '', operator = ':', value = ''] = field
    const aliasKey = keyOf(name)
    const key = FIELD_LOOKUP.get(aliasKey)
    if (key !== undefined) return parseFieldToken(raw, negate, key, aliasKey, operator, value)
    // Champ inconnu : on le cherche comme du texte, avec un avertissement.
    const words = normalizeWords(body)
    const message = `« ${name}: » n'est pas un filtre connu : cherché comme texte.`
    return words === ''
      ? { kind: 'ignored', raw, negate, message }
      : { kind: 'word', raw, negate, value: words }
  }

  const id = ID_TOKEN.exec(body)
  if (id) return { kind: 'id', raw, negate, value: Number(id[1] ?? id[2]) }

  if (FULL_SET_CODE.test(body)) {
    const key = setCodeKey(body)
    if (key !== undefined) {
      const region = /-([A-Z]{0,2})\d{3}$/i.exec(body)?.[1]?.toUpperCase() ?? ''
      return { kind: 'code', raw, negate, value: key, region }
    }
  }

  if (!negate && OWNED_WORDS.has(keyOf(body))) return { kind: 'owned', raw, negate }

  const words = normalizeWords(body)
  return words === ''
    ? { kind: 'ignored', raw, negate }
    : { kind: 'word', raw, negate, value: words }
}

/** Message d'avertissement associé à un jeton (y compris les champs inconnus cherchés comme texte). */
function tokenWarning(token: QueryToken): string | undefined {
  if (token.kind === 'ignored') return token.message
  if (token.kind === 'word') {
    const field = FIELD_TOKEN.exec(token.negate ? token.raw.slice(1) : token.raw)
    if (field) return `« ${field[1] ?? ''}: » n'est pas un filtre connu : cherché comme texte.`
  }
  if ((token.kind === 'id' || token.kind === 'code' || token.kind === 'owned') && token.negate) {
    return `L'exclusion « ${token.raw} » n'est pas prise en charge : jeton ignoré.`
  }
  return undefined
}

// --- Puces lisibles ----------------------------------------------------------------

function rangeLabel(field: NumberField, range: NumberRange): string {
  const name = FIELD_LABELS[field]
  const { min, max } = range
  // Pas de séparateur de milliers : « ATK 2500 » est l'écriture habituelle du jeu.
  const format = (n: number) => String(n)
  if (min !== undefined && max !== undefined) {
    return min === max ? `${name} = ${format(min)}` : `${name} de ${format(min)} à ${format(max)}`
  }
  if (min !== undefined) return `${name} ≥ ${format(min)}`
  if (max !== undefined) return `${name} ≤ ${format(max)}`
  return name
}

function chipLabel(token: QueryToken): string | undefined {
  switch (token.kind) {
    case 'word':
      return `« ${token.value} »`
    case 'phrase':
      return `Expression « ${token.value} »`
    case 'id':
      return `Passcode ${token.value}`
    case 'code':
      return `Code ${token.raw
        .replace(/^-/, '')
        .replace(/^[^:]*:/, '')
        .toUpperCase()}`
    case 'range':
      return rangeLabel(token.field, token.range)
    case 'owned':
      return 'Dans ma collection'
    case 'field': {
      const { field, values } = token.filter
      const joiner = field === 'marker' ? ' et ' : ' ou '
      const label = token.origin === 'code' ? 'Code commençant par' : FIELD_LABELS[field]
      return `${label} : ${values.map((v) => v.label).join(joiner)}`
    }
    case 'ignored':
      return undefined
  }
}

// --- Analyse complète ----------------------------------------------------------------

function mergeRange(current: NumberRange | undefined, next: NumberRange): NumberRange {
  const merged: NumberRange = { ...current }
  if (next.min !== undefined) merged.min = Math.max(merged.min ?? next.min, next.min)
  if (next.max !== undefined) merged.max = Math.min(merged.max ?? next.max, next.max)
  return merged
}

export function emptyQuery(): SearchQuery {
  return {
    words: [],
    phrases: [],
    excluded: [],
    freeText: '',
    ids: [],
    codes: [],
    regions: [],
    filters: [],
    ranges: {},
    ownedOnly: false,
  }
}

/** Analyse la saisie complète : requête structurée, puces et avertissements. */
export function parseQuery(input: string): ParsedQuery {
  const tokens = tokenize(input).map(parseToken)
  const query = emptyQuery()
  const chips: QueryChip[] = []
  const warnings: string[] = []
  const freeParts: string[] = []

  tokens.forEach((token, tokenIndex) => {
    const warning = tokenWarning(token)
    if (warning !== undefined) warnings.push(warning)
    const unsupportedNegation =
      token.negate && (token.kind === 'id' || token.kind === 'code' || token.kind === 'owned')
    if (token.kind === 'ignored' || unsupportedNegation) return

    switch (token.kind) {
      case 'word':
      case 'phrase':
        if (token.negate) {
          query.excluded.push(token.value)
        } else if (token.kind === 'word') {
          query.words.push(...token.value.split(' '))
          freeParts.push(token.value)
        } else {
          query.phrases.push(token.value)
          freeParts.push(token.value)
        }
        break
      case 'id':
        query.ids.push(token.value)
        break
      case 'code':
        query.codes.push(token.value)
        if (token.region !== '') query.regions.push(token.region)
        break
      case 'range':
        query.ranges[token.field] = mergeRange(query.ranges[token.field], token.range)
        break
      case 'owned':
        query.ownedOnly = true
        break
      case 'field':
        query.filters.push(token.filter)
        break
    }
    const label = chipLabel(token)
    if (label !== undefined) {
      chips.push({
        tokenIndex,
        label: token.negate ? `Sans ${label}` : label,
        negate: token.negate,
      })
    }
  })

  query.freeText = freeParts.join(' ')
  return { query, tokens, chips, warnings, isEmpty: chips.length === 0 }
}

/** Retire un jeton de la saisie (clic sur la croix d'une puce). */
export function removeToken(input: string, tokenIndex: number): string {
  return tokenize(input)
    .filter((_, index) => index !== tokenIndex)
    .join(' ')
}
