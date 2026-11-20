/**
 * Moteur de recherche local : exécute une `SearchQuery` sur les cartes stockées dans IndexedDB.
 *
 * Stratégie :
 * - les ~12 000 cartes sont lues une fois, puis gardées en mémoire avec leurs textes déjà
 *   normalisés (sans accents, minuscules) : chaque recherche n'est plus qu'un parcours de tableau ;
 * - ce cache est reconstruit quand le nombre de cartes change ou après une synchronisation
 *   (`invalidate()`) ;
 * - avant que le cache existe, une recherche par passcode ou code d'impression utilise
 *   directement les index Dexie (`id`, `*setKeys`) pour répondre tout de suite.
 * Doc Dexie : https://dexie.org/docs/Table/Table.bulkGet() et https://dexie.org/docs/MultiEntry-Index
 */
import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { setCodeKey } from '@/domain/setCode'
import { normalizeWords } from './normalize'
import {
  NUMBER_FIELDS,
  type FieldFilter,
  type FilterValue,
  type NumberField,
  type SearchQuery,
} from './queryParser'
import { CARD_CATEGORIES, kindsOfType } from './vocabulary'

export const SORT_OPTIONS = [
  { value: 'relevance', label: 'Pertinence' },
  { value: 'name', label: 'Nom (A → Z)' },
  { value: 'name-desc', label: 'Nom (Z → A)' },
  { value: 'atk', label: 'ATK (plus forte)' },
  { value: 'atk-asc', label: 'ATK (plus faible)' },
  { value: 'def', label: 'DEF (plus forte)' },
  { value: 'def-asc', label: 'DEF (plus faible)' },
  { value: 'level', label: 'Niveau/Rang (plus haut)' },
  { value: 'level-asc', label: 'Niveau/Rang (plus bas)' },
  { value: 'recent', label: 'Passcode (récents en premier)' },
] as const

export type SortOption = (typeof SORT_OPTIONS)[number]['value']

export function isSortOption(value: string): value is SortOption {
  return SORT_OPTIONS.some((option) => option.value === value)
}

export interface SearchOptions {
  sort?: SortOption
  offset?: number
  limit?: number
}

export interface SearchHit {
  card: CardData
  /** Score de pertinence (plus haut = plus pertinent). */
  score: number
  /** Nombre d'exemplaires dans la collection (0 si aucun). */
  ownedQuantity: number
  /** Vrai si le texte libre a été trouvé dans le nom anglais plutôt que dans le nom français. */
  matchedEnglish: boolean
  /** Code d'impression correspondant à la recherche, ex. « LOB-FR001 ». */
  matchedSetCode?: string
}

export interface SearchResult {
  hits: SearchHit[]
  total: number
  durationMs: number
}

export interface SearchFacets {
  kinds: string[]
  attributes: string[]
  monsterRaces: string[]
  spellTrapRaces: string[]
  archetypes: string[]
  /** Préfixes d'extension avec le nom le plus fréquent, ex. { prefix: 'LOB', name: '…' }. */
  sets: { prefix: string; name: string }[]
  rarities: string[]
}

export const DEFAULT_PAGE_SIZE = 30

/** Carte accompagnée de ses textes normalisés (calculés une seule fois). */
interface IndexedCard {
  card: CardData
  name: string
  nameEn: string
  /** Texte précédé d'une espace : `desc.includes(' ' + mot)` teste un début de mot. */
  desc: string
  kinds: ReadonlySet<string>
  typeText: string
  race: string
  archetype: string
  level: number | undefined
}

function indexCard(card: CardData): IndexedCard {
  return {
    card,
    name: normalizeWords(card.name),
    nameEn: card.nameEn === undefined ? '' : normalizeWords(card.nameEn),
    desc: ` ${normalizeWords(card.desc)}`,
    kinds: new Set(kindsOfType(card.type)),
    typeText: normalizeWords(`${card.type} ${card.typeLabel ?? ''} ${card.frameType} ${card.race}`),
    race: normalizeWords(card.race),
    archetype: normalizeWords(card.archetype ?? ''),
    level: card.level ?? card.linkval,
  }
}

// --- Correspondance -------------------------------------------------------------

/** Le mot apparaît dans le nom (n'importe où) : « drag » trouve « Dragon », « blanc » trouve « Dragon Blanc ». */
function inName(entry: IndexedCard, word: string): boolean {
  return entry.name.includes(word) || (entry.nameEn !== '' && entry.nameEn.includes(word))
}

/** Le mot commence un mot du texte (évite que « de » trouve « monde »). */
function inDesc(entry: IndexedCard, word: string): boolean {
  return entry.desc.includes(` ${word}`)
}

function matchesFree(entry: IndexedCard, text: string): boolean {
  return inName(entry, text) || inDesc(entry, text)
}

function matchesValue(entry: IndexedCard, field: FieldFilter['field'], v: FilterValue): boolean {
  switch (field) {
    case 'name':
      return v.value.split(' ').every((word) => inName(entry, word))
    case 'en': {
      const english = entry.nameEn === '' ? entry.name : entry.nameEn
      return v.value.split(' ').every((word) => english.includes(word))
    }
    case 'text':
      return v.value.split(' ').every((word) => inDesc(entry, word))
    case 'type':
      return v.exact ? entry.kinds.has(v.value) : entry.typeText.includes(v.value)
    case 'attr':
      return entry.card.attribute === v.value
    case 'race':
      return v.exact ? entry.card.race === v.value : entry.race.includes(v.value)
    case 'arch':
      return entry.archetype.includes(v.value)
    case 'marker':
      return entry.card.linkmarkers?.includes(v.value) ?? false
    case 'set':
      return entry.card.sets.some((set) => matchesSet(set, v.value))
    case 'rarity':
      return entry.card.sets.some((set) => normalizeWords(set.rarity).includes(v.value))
  }
}

/** Extension : préfixe du code (« LOB », « LOB-FR0 ») ou début d'un mot du nom de l'extension. */
function matchesSet(set: CardData['sets'][number], value: string): boolean {
  const upper = value.toUpperCase()
  const code = set.code.toUpperCase()
  if (code === upper || code.startsWith(upper.includes('-') ? upper : `${upper}-`)) return true
  const words = normalizeWords(value)
  return words.length >= 3 && ` ${normalizeWords(set.name)}`.includes(` ${words}`)
}

function matchesFilter(entry: IndexedCard, filter: FieldFilter): boolean {
  const matches =
    filter.field === 'marker'
      ? filter.values.every((v) => matchesValue(entry, 'marker', v))
      : filter.values.some((v) => matchesValue(entry, filter.field, v))
  return filter.negate ? !matches : matches
}

/** Extension et rareté positives doivent concerner la même impression (« LOB » en « Ultra Rare »). */
function matchesSamePrint(entry: IndexedCard, sets: FieldFilter[], rarities: FieldFilter[]) {
  return entry.card.sets.some(
    (set) =>
      sets.every((f) => f.values.some((v) => matchesSet(set, v.value))) &&
      rarities.every((f) => f.values.some((v) => normalizeWords(set.rarity).includes(v.value))),
  )
}

const RANGE_GETTERS: Record<NumberField, (entry: IndexedCard) => number | undefined> = {
  atk: (e) => e.card.atk,
  def: (e) => e.card.def,
  level: (e) => e.card.level,
  link: (e) => e.card.linkval,
  scale: (e) => e.card.scale,
}

/** Compile la requête en une fonction de test, appelée sur chaque carte. */
function buildPredicate(query: SearchQuery): (entry: IndexedCard) => boolean {
  const ids = new Set(query.ids)
  const codes = new Set(query.codes)
  const positivePrint = query.filters.filter(
    (f) => !f.negate && (f.field === 'set' || f.field === 'rarity'),
  )
  const samePrintSets = positivePrint.filter((f) => f.field === 'set')
  const samePrintRarities = positivePrint.filter((f) => f.field === 'rarity')
  const otherFilters = query.filters.filter((f) => !positivePrint.includes(f))
  const ranges = NUMBER_FIELDS.flatMap((field) => {
    const range = query.ranges[field]
    return range ? [{ getter: RANGE_GETTERS[field], min: range.min, max: range.max }] : []
  })

  return (entry) => {
    if (ids.size > 0 || codes.size > 0) {
      const identified = ids.has(entry.card.id) || entry.card.setKeys.some((key) => codes.has(key))
      if (!identified) return false
    }
    for (const word of query.words) if (!matchesFree(entry, word)) return false
    for (const phrase of query.phrases) if (!matchesFree(entry, phrase)) return false
    for (const excluded of query.excluded) if (matchesFree(entry, excluded)) return false
    for (const { getter, min, max } of ranges) {
      const value = getter(entry)
      if (value === undefined) return false
      if (min !== undefined && value < min) return false
      if (max !== undefined && value > max) return false
    }
    for (const filter of otherFilters) if (!matchesFilter(entry, filter)) return false
    if (positivePrint.length > 0 && !matchesSamePrint(entry, samePrintSets, samePrintRarities)) {
      return false
    }
    return true
  }
}

// --- Pertinence -------------------------------------------------------------------

interface Scored {
  entry: IndexedCard
  score: number
  matchedEnglish: boolean
}

/** Score d'un nom : exact > commence par > tous les mots présents (bonus si débuts de mots). */
function nameScore(name: string, full: string, words: readonly string[]): number {
  if (name === '') return 0
  if (name === full) return 1000
  if (name.startsWith(full)) return 800
  if (words.every((word) => name.includes(word))) {
    const padded = ` ${name}`
    const wordStarts = words.every((word) => padded.includes(` ${word}`))
    return wordStarts ? 650 : 600
  }
  return 0
}

function scoreEntry(entry: IndexedCard, query: SearchQuery): Scored {
  const full = query.freeText
  if (full === '') return { entry, score: 0, matchedEnglish: false }
  const words = [...query.words, ...query.phrases]
  const french = nameScore(entry.name, full, words)
  // Le nom anglais compte un peu moins que le nom français.
  const english = nameScore(entry.nameEn, full, words) * 0.95
  if (french > 0 || english > 0) {
    return { entry, score: Math.max(french, english), matchedEnglish: english > french }
  }
  // Mots répartis entre noms et texte : les mots trouvés dans un nom font monter la carte.
  const inNames = words.filter((word) => inName(entry, word)).length
  const englishOnly = words.some((w) => !entry.name.includes(w) && entry.nameEn.includes(w))
  return { entry, score: 100 + inNames * 50, matchedEnglish: englishOnly }
}

/**
 * Comparaison de chaînes à la française : « Élan » se range avec les « E », pas après « Z ».
 * `Intl.Collator` fait la même chose que `localeCompare('fr')`, en plus rapide sur de gros tris.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator
 */
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
const byName = (a: Scored, b: Scored) => collator.compare(a.entry.card.name, b.entry.card.name)

function byNumber(get: (e: IndexedCard) => number | undefined, direction: 1 | -1) {
  return (a: Scored, b: Scored) => {
    const x = get(a.entry)
    const y = get(b.entry)
    if (x === y) return byName(a, b)
    if (x === undefined) return 1 // les cartes sans valeur (Magies…) vont à la fin
    if (y === undefined) return -1
    return (x - y) * direction || byName(a, b)
  }
}

function comparatorFor(sort: SortOption): (a: Scored, b: Scored) => number {
  switch (sort) {
    case 'relevance':
      return (a, b) =>
        b.score - a.score || a.entry.name.length - b.entry.name.length || byName(a, b)
    case 'name':
      return byName
    case 'name-desc':
      return (a, b) => byName(b, a)
    case 'atk':
      return byNumber((e) => e.card.atk, -1)
    case 'atk-asc':
      return byNumber((e) => e.card.atk, 1)
    case 'def':
      return byNumber((e) => e.card.def, -1)
    case 'def-asc':
      return byNumber((e) => e.card.def, 1)
    case 'level':
      return byNumber((e) => e.level, -1)
    case 'level-asc':
      return byNumber((e) => e.level, 1)
    case 'recent':
      return (a, b) => b.entry.card.id - a.entry.card.id
  }
}

/**
 * Filtre et trie des cartes déjà indexées (fonction pure, testable sans base de données).
 */
function rank(entries: readonly IndexedCard[], query: SearchQuery, sort: SortOption): Scored[] {
  const predicate = buildPredicate(query)
  const scored: Scored[] = []
  for (const entry of entries) if (predicate(entry)) scored.push(scoreEntry(entry, query))
  // Sans texte libre, tous les scores sont nuls : la pertinence revient à l'ordre alphabétique.
  const effectiveSort = sort === 'relevance' && query.freeText === '' ? 'name' : sort
  return scored.sort(comparatorFor(effectiveSort))
}

function matchedSetCode(card: CardData, query: SearchQuery): string | undefined {
  if (query.codes.length === 0) return undefined
  const codes = new Set(query.codes)
  const matching = card.sets.filter((set) => codes.has(setCodeKey(set.code) ?? ''))
  // On préfère l'impression dans la région tapée (« LOB-FR001 »), sinon la première.
  const inRegion = matching.find((set) =>
    query.regions.some((region) => region !== '' && set.code.toUpperCase().includes(`-${region}`)),
  )
  return (inRegion ?? matching[0])?.code
}

// --- Moteur avec cache --------------------------------------------------------------

interface CardCache {
  count: number
  entries: IndexedCard[]
  byId: Map<number, IndexedCard>
  bySetKey: Map<string, IndexedCard[]>
}

export class SearchEngine {
  private cache: CardCache | undefined
  private loading: Promise<CardCache> | undefined
  private memo: { key: string; cache: CardCache; ranked: Scored[] } | undefined
  private facetsMemo: { cache: CardCache; facets: SearchFacets } | undefined

  constructor(private readonly db: AppDatabase) {}

  /** Oublie le cache (à appeler après une synchronisation des cartes). */
  invalidate(): void {
    this.cache = undefined
    this.loading = undefined
    this.memo = undefined
    this.facetsMemo = undefined
  }

  private async loadCache(count: number): Promise<CardCache> {
    const cards = await this.db.cards.toArray()
    const entries = cards.map(indexCard)
    const bySetKey = new Map<string, IndexedCard[]>()
    for (const entry of entries) {
      for (const key of entry.card.setKeys) {
        const list = bySetKey.get(key)
        if (list) list.push(entry)
        else bySetKey.set(key, [entry])
      }
    }
    return {
      count,
      entries,
      byId: new Map(entries.map((entry) => [entry.card.id, entry])),
      bySetKey,
    }
  }

  /** Cache à jour : reconstruit si le nombre de cartes a changé depuis la dernière lecture. */
  private async getCache(): Promise<CardCache> {
    const count = await this.db.cards.count()
    if (this.cache && this.cache.count === count) return this.cache
    if (!this.loading) {
      this.loading = this.loadCache(count).then((cache) => {
        this.cache = cache
        this.loading = undefined
        return cache
      })
    }
    return this.loading
  }

  /** Exemplaires possédés, regroupés par carte. Doc : https://dexie.org/docs/Table/Table.each() */
  private async ownedQuantities(): Promise<Map<number, number>> {
    const owned = new Map<number, number>()
    await this.db.collection.each((entry) => {
      owned.set(entry.cardId, (owned.get(entry.cardId) ?? 0) + entry.quantity)
    })
    return owned
  }

  /** Recherche via les index quand on ne cherche que des passcodes/codes et que le cache est froid. */
  private async indexedCandidates(query: SearchQuery): Promise<IndexedCard[]> {
    const [byId, byCode] = await Promise.all([
      this.db.cards.bulkGet(query.ids),
      query.codes.length > 0
        ? this.db.cards.where('setKeys').anyOf(query.codes).toArray()
        : Promise.resolve([]),
    ])
    const unique = new Map<number, CardData>()
    for (const card of [...byId, ...byCode]) if (card) unique.set(card.id, card)
    return [...unique.values()].map(indexCard)
  }

  async search(query: SearchQuery, options: SearchOptions = {}): Promise<SearchResult> {
    const start = performance.now()
    const { sort = 'relevance', offset = 0, limit = DEFAULT_PAGE_SIZE } = options
    const identityOnly = query.ids.length > 0 || query.codes.length > 0

    let ranked: Scored[]
    if (identityOnly && !this.cache) {
      ranked = rank(await this.indexedCandidates(query), query, sort)
    } else {
      const cache = await this.getCache()
      const key = JSON.stringify([query, sort])
      if (this.memo && this.memo.key === key && this.memo.cache === cache) {
        ranked = this.memo.ranked // « Afficher plus » : pas de nouveau tri
      } else {
        // Passcodes et codes d'impression : les tables d'accès direct évitent un parcours complet.
        const candidates = identityOnly
          ? [
              ...new Set([
                ...query.ids.flatMap((id) => cache.byId.get(id) ?? []),
                ...query.codes.flatMap((code) => cache.bySetKey.get(code) ?? []),
              ]),
            ]
          : cache.entries
        ranked = rank(candidates, query, sort)
        this.memo = { key, cache, ranked }
      }
    }

    const owned = await this.ownedQuantities()
    const visible = query.ownedOnly ? ranked.filter((s) => owned.has(s.entry.card.id)) : ranked
    const hits = visible
      .slice(offset, offset + limit)
      .map(({ entry, score, matchedEnglish }): SearchHit => {
        const hit: SearchHit = {
          card: entry.card,
          score,
          matchedEnglish,
          ownedQuantity: owned.get(entry.card.id) ?? 0,
        }
        const code = matchedSetCode(entry.card, query)
        if (code !== undefined) hit.matchedSetCode = code
        return hit
      })
    return { hits, total: visible.length, durationMs: performance.now() - start }
  }

  /** Valeurs distinctes présentes dans les données, pour les listes du mode avancé. */
  async facets(): Promise<SearchFacets> {
    const cache = await this.getCache()
    if (this.facetsMemo?.cache === cache) return this.facetsMemo.facets
    const kinds = new Set<string>()
    const attributes = new Set<string>()
    const monsterRaces = new Set<string>()
    const spellTrapRaces = new Set<string>()
    const archetypes = new Set<string>()
    const rarities = new Set<string>()
    const setNames = new Map<string, Map<string, number>>()

    for (const { card } of cache.entries) {
      for (const kind of kindsOfType(card.type)) kinds.add(kind)
      if (card.attribute) attributes.add(card.attribute)
      if (card.race) {
        const isMonster = card.type.includes('Monster') || card.type === 'Token'
        ;(isMonster ? monsterRaces : spellTrapRaces).add(card.race)
      }
      if (card.archetype) archetypes.add(card.archetype)
      for (const set of card.sets) {
        if (set.rarity) rarities.add(set.rarity)
        const prefix = set.code.split('-')[0]?.toUpperCase()
        if (!prefix) continue
        const names = setNames.get(prefix) ?? new Map<string, number>()
        names.set(set.name, (names.get(set.name) ?? 0) + 1)
        setNames.set(prefix, names)
      }
    }

    const sorted = (values: Iterable<string>) => [...values].sort((a, b) => collator.compare(a, b))
    const categories: readonly string[] = CARD_CATEGORIES
    const facets: SearchFacets = {
      kinds: sorted(kinds).filter((kind) => !categories.includes(kind)),
      attributes: sorted(attributes),
      monsterRaces: sorted(monsterRaces),
      spellTrapRaces: sorted(spellTrapRaces),
      archetypes: sorted(archetypes),
      rarities: sorted(rarities),
      sets: [...setNames.entries()]
        .map(([prefix, names]) => {
          const best = [...names.entries()].sort((a, b) => b[1] - a[1])[0]
          return { prefix, name: best?.[0] ?? '' }
        })
        .sort((a, b) => collator.compare(a.prefix, b.prefix)),
    }
    this.facetsMemo = { cache, facets }
    return facets
  }
}
