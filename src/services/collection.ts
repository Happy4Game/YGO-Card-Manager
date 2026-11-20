import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { CARD_CONDITIONS, type CardCondition, type CollectionEntry } from '@/domain/collection'

/**
 * Logique métier de la collection.
 *
 * Chaque fonction reçoit la base en paramètre (« injection de dépendance ») : en production on
 * passe la base réelle, dans les tests une base isolée (fake-indexeddb). Aucune dépendance à Vue.
 */

/** Langues d'impression proposées dans le formulaire (codes ISO 639-1). */
export const COLLECTION_LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'Anglais' },
  { code: 'de', label: 'Allemand' },
  { code: 'it', label: 'Italien' },
  { code: 'pt', label: 'Portugais' },
  { code: 'es', label: 'Espagnol' },
  { code: 'ja', label: 'Japonais' },
] as const

/** Données saisies pour une nouvelle entrée : l'id est attribué par IndexedDB, la date est optionnelle. */
export type NewCollectionEntry = Omit<CollectionEntry, 'id' | 'addedAt'> & { addedAt?: string }

/** Champs modifiables d'une entrée existante. */
export type CollectionEntryChanges = Partial<Omit<CollectionEntry, 'id'>>

/** Une entrée enrichie du nom de sa carte, prête à afficher. */
export interface CollectionItem extends CollectionEntry {
  id: number
  cardName: string
  /** `false` si la carte n'est pas (encore) présente dans le cache local `cards`. */
  cardKnown: boolean
}

export interface CollectionFilters {
  /** Recherche libre sur le nom de la carte ou le code d'impression. */
  text?: string
  location?: string
  condition?: CardCondition | ''
}

export type CollectionSortKey = 'name' | 'addedAt' | 'quantity'
export type SortDirection = 'asc' | 'desc'

export interface CollectionSort {
  key: CollectionSortKey
  direction: SortDirection
}

export interface StatCount {
  /** Valeur regroupée (emplacement, préfixe d'extension) ; chaîne vide = non renseigné. */
  label: string
  copies: number
}

export interface CollectionStats {
  /** Nombre total d'exemplaires (somme des quantités). */
  totalCopies: number
  /** Nombre de cartes différentes (cardId distincts). */
  distinctCards: number
  byLocation: StatCount[]
  bySet: StatCount[]
}

/** Erreur métier : message en français, affichable tel quel à l'utilisateur. */
export class CollectionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'CollectionError'
  }
}

/** Nom affiché quand la carte n'est pas encore dans le cache local. */
export function fallbackCardName(cardId: number): string {
  return `Carte #${cardId}`
}

/** Préfixe d'extension d'un code d'impression : "LOB-EN001" → "LOB". Vide si pas de code. */
export function setPrefix(setCode: string): string {
  const trimmed = setCode.trim()
  if (trimmed === '') return ''
  const [prefix = ''] = trimmed.split('-')
  return prefix.toUpperCase()
}

export function isCardCondition(value: unknown): value is CardCondition {
  return typeof value === 'string' && (CARD_CONDITIONS as readonly string[]).includes(value)
}

/** Vérifie les règles métier d'une entrée et nettoie les textes (espaces superflus). */
function normalizeEntry(input: NewCollectionEntry): Omit<CollectionEntry, 'id'> {
  if (!Number.isInteger(input.cardId) || input.cardId <= 0) {
    throw new CollectionError("L'identifiant de carte doit être un entier positif.")
  }
  assertQuantity(input.quantity)
  if (!isCardCondition(input.condition)) {
    throw new CollectionError(`État inconnu : ${String(input.condition)}.`)
  }
  return {
    cardId: input.cardId,
    setCode: input.setCode.trim(),
    rarity: input.rarity.trim(),
    language: input.language.trim(),
    condition: input.condition,
    quantity: input.quantity,
    location: input.location.trim(),
    note: input.note.trim(),
    addedAt: input.addedAt ?? new Date().toISOString(),
  }
}

function assertQuantity(quantity: number): void {
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new CollectionError('La quantité doit être un entier supérieur ou égal à 1.')
  }
}

/** Deux entrées décrivent les mêmes exemplaires si ces cinq champs sont identiques. */
function isSameCopy(a: Omit<CollectionEntry, 'id'>, b: Omit<CollectionEntry, 'id'>): boolean {
  return (
    a.cardId === b.cardId &&
    a.setCode === b.setCode &&
    a.language === b.language &&
    a.condition === b.condition &&
    a.location === b.location
  )
}

/**
 * Ajoute des exemplaires. Si une entrée identique existe déjà (même carte, impression, langue,
 * état et emplacement), sa quantité est augmentée au lieu de créer un doublon.
 *
 * La transaction garantit que la lecture puis l'écriture ne sont pas entrecoupées par une autre
 * écriture (doc : https://dexie.org/docs/Dexie/Dexie.transaction()).
 *
 * @returns l'id de l'entrée créée ou mise à jour.
 */
export async function addEntry(db: AppDatabase, input: NewCollectionEntry): Promise<number> {
  const entry = normalizeEntry(input)
  return db.transaction('rw', db.collection, async () => {
    // L'index `cardId` limite la lecture aux entrées de cette carte.
    const existing = await db.collection
      .where('cardId')
      .equals(entry.cardId)
      .filter((candidate) => isSameCopy(candidate, entry))
      .first()

    if (existing?.id !== undefined) {
      await db.collection.update(existing.id, { quantity: existing.quantity + entry.quantity })
      return existing.id
    }
    const id = await db.collection.add(entry)
    // Avec une clé `++id`, IndexedDB renvoie toujours un nombre ; le test rassure TypeScript.
    if (id === undefined) throw new CollectionError("L'entrée n'a pas pu être enregistrée.")
    return id
  })
}

/** Modifie une entrée existante. Lève une erreur si elle n'existe pas. */
export async function updateEntry(
  db: AppDatabase,
  id: number,
  changes: CollectionEntryChanges,
): Promise<void> {
  await db.transaction('rw', db.collection, async () => {
    const current = await db.collection.get(id)
    if (!current) throw new CollectionError('Cette entrée n’existe plus.')
    // On revalide l'entrée complète, pour ne jamais enregistrer un état incohérent.
    const next = normalizeEntry({ ...current, ...changes })
    await db.collection.put({ ...next, id })
  })
}

export async function removeEntry(db: AppDatabase, id: number): Promise<void> {
  await db.collection.delete(id)
}

/**
 * Ajoute `delta` (positif ou négatif) à la quantité. À 0 ou moins, l'entrée est supprimée.
 *
 * @returns la nouvelle quantité (0 si l'entrée a été supprimée).
 */
export async function changeQuantity(db: AppDatabase, id: number, delta: number): Promise<number> {
  if (!Number.isInteger(delta)) {
    throw new CollectionError('La variation de quantité doit être un entier.')
  }
  return db.transaction('rw', db.collection, async () => {
    const current = await db.collection.get(id)
    if (!current) throw new CollectionError('Cette entrée n’existe plus.')
    const quantity = current.quantity + delta
    if (quantity <= 0) {
      await db.collection.delete(id)
      return 0
    }
    await db.collection.update(id, { quantity })
    return quantity
  })
}

/** Lit une carte du cache local, ou `undefined` si elle n'a pas encore été synchronisée. */
export async function findCard(db: AppDatabase, cardId: number): Promise<CardData | undefined> {
  if (!Number.isInteger(cardId) || cardId <= 0) return undefined
  return db.cards.get(cardId)
}

/** Associe chaque cardId à son nom (une seule lecture groupée grâce à `bulkGet`). */
export async function cardNames(
  db: AppDatabase,
  cardIds: readonly number[],
): Promise<Map<number, string>> {
  const uniqueIds = [...new Set(cardIds)]
  const cards = await db.cards.bulkGet(uniqueIds)
  const names = new Map<number, string>()
  for (const card of cards) {
    if (card) names.set(card.id, card.name)
  }
  return names
}

/**
 * Met un texte sous une forme comparable : minuscules et sans accents ("Élan" → "elan").
 * Doc : https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
 */
function searchable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}

// Comparaison de chaînes adaptée au français (accents, casse).
// Doc : https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator
const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true })

function compareItems(a: CollectionItem, b: CollectionItem, key: CollectionSortKey): number {
  switch (key) {
    case 'name':
      return collator.compare(a.cardName, b.cardName) || collator.compare(a.setCode, b.setCode)
    case 'quantity':
      return a.quantity - b.quantity
    case 'addedAt':
      // Les dates ISO 8601 se comparent correctement comme des chaînes.
      return a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0
  }
}

/** Liste les entrées avec le nom de leur carte, filtrées et triées. */
export async function listEntries(
  db: AppDatabase,
  filters: CollectionFilters = {},
  sort: CollectionSort = { key: 'addedAt', direction: 'desc' },
): Promise<CollectionItem[]> {
  const entries = await db.collection.toArray()
  const names = await cardNames(
    db,
    entries.map((entry) => entry.cardId),
  )

  const items: CollectionItem[] = []
  for (const entry of entries) {
    if (entry.id === undefined) continue
    const name = names.get(entry.cardId)
    items.push({
      ...entry,
      id: entry.id,
      cardName: name ?? fallbackCardName(entry.cardId),
      cardKnown: name !== undefined,
    })
  }

  const text = searchable(filters.text?.trim() ?? '')
  const filtered = items.filter(
    (item) =>
      (text === '' ||
        searchable(item.cardName).includes(text) ||
        searchable(item.setCode).includes(text)) &&
      (!filters.location || item.location === filters.location) &&
      (!filters.condition || item.condition === filters.condition),
  )

  const factor = sort.direction === 'asc' ? 1 : -1
  // L'id sert de départage pour un ordre stable et prévisible.
  return filtered.sort((a, b) => factor * (compareItems(a, b, sort.key) || a.id - b.id))
}

function countBy(entries: readonly CollectionEntry[], keyOf: (e: CollectionEntry) => string) {
  const counts = new Map<string, number>()
  for (const entry of entries) {
    const key = keyOf(entry)
    counts.set(key, (counts.get(key) ?? 0) + entry.quantity)
  }
  return [...counts]
    .map(([label, copies]): StatCount => ({ label, copies }))
    .sort((a, b) => b.copies - a.copies || collator.compare(a.label, b.label))
}

/** Calcule les statistiques d'une liste d'entrées (fonction pure, sans base). */
export function computeStats(entries: readonly CollectionEntry[]): CollectionStats {
  return {
    totalCopies: entries.reduce((sum, entry) => sum + entry.quantity, 0),
    distinctCards: new Set(entries.map((entry) => entry.cardId)).size,
    byLocation: countBy(entries, (entry) => entry.location),
    bySet: countBy(entries, (entry) => setPrefix(entry.setCode)),
  }
}

export async function getStats(db: AppDatabase): Promise<CollectionStats> {
  return computeStats(await db.collection.toArray())
}

/** Emplacements déjà utilisés (non vides, sans doublon, triés) : pour l'autocomplétion. */
export async function listLocations(db: AppDatabase): Promise<string[]> {
  // `uniqueKeys` lit directement l'index `location`, sans charger les entrées.
  // Doc : https://dexie.org/docs/Collection/Collection.uniqueKeys()
  const keys = await db.collection.orderBy('location').uniqueKeys()
  return keys
    .filter((key): key is string => typeof key === 'string' && key !== '')
    .sort(collator.compare)
}
