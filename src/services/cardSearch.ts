import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { normalizeText } from '@/services/search/normalize'

/**
 * Recherche simple par filtres exacts (API historique, conservée pour compatibilité).
 * La page de recherche utilise `@/services/search` (champ universel + mode avancé).
 */

/** Filtres de recherche ; un filtre vide ou absent est ignoré. */
export interface CardSearchFilters {
  /** Sous-chaîne du nom, insensible à la casse et aux accents. */
  name?: string
  type?: string
  attribute?: string
  race?: string
  archetype?: string
}

export interface CardSearchPage {
  limit?: number
  offset?: number
}

export interface CardSearchResult {
  items: CardData[]
  /** Nombre total de cartes correspondantes (toutes pages confondues). */
  total: number
}

export const DEFAULT_PAGE_SIZE = 20

// La normalisation vit désormais dans le module de recherche universelle ; réexportée ici
// pour les modules qui l'importaient depuis cardSearch.
export { normalizeText }

function buildPredicate(filters: CardSearchFilters): (card: CardData) => boolean {
  const name = normalizeText(filters.name?.trim() ?? '')
  const { type, attribute, race, archetype } = filters
  return (card) =>
    (!name || normalizeText(card.name).includes(name)) &&
    (!type || card.type === type) &&
    (!attribute || card.attribute === attribute) &&
    (!race || card.race === race) &&
    (!archetype || card.archetype === archetype)
}

/**
 * Recherche hors ligne dans les cartes stockées, triées par nom.
 * On parcourt l'index `name` en filtrant en JavaScript : quelques milliers de cartes
 * se parcourent rapidement, sans multiplier les index IndexedDB.
 * Doc Dexie : https://dexie.org/docs/Collection/Collection.filter()
 */
export async function searchCards(
  db: AppDatabase,
  filters: CardSearchFilters,
  { limit = DEFAULT_PAGE_SIZE, offset = 0 }: CardSearchPage = {},
): Promise<CardSearchResult> {
  const matching = () => db.cards.orderBy('name').filter(buildPredicate(filters))
  // Avec `filter`, Dexie applique `offset` et `limit` sur les résultats déjà filtrés.
  const [total, items] = await Promise.all([
    matching().count(),
    matching().offset(offset).limit(limit).toArray(),
  ])
  return { items, total }
}

export interface CardFilterOptions {
  types: string[]
  attributes: string[]
  races: string[]
}

const byFrenchOrder = (a: string, b: string) => a.localeCompare(b, 'fr')

/** Valeurs distinctes présentes en base, pour remplir les listes déroulantes de filtres. */
export async function listFilterOptions(db: AppDatabase): Promise<CardFilterOptions> {
  const attributes = new Set<string>()
  const races = new Set<string>()
  // `type` est indexé : `uniqueKeys()` lit directement l'index, sans charger les cartes.
  const typesPromise = db.cards.orderBy('type').uniqueKeys()
  await db.cards.each((card) => {
    if (card.attribute) attributes.add(card.attribute)
    if (card.race) races.add(card.race)
  })
  const types = (await typesPromise).filter((key): key is string => typeof key === 'string')
  return {
    types: types.sort(byFrenchOrder),
    attributes: [...attributes].sort(byFrenchOrder),
    races: [...races].sort(byFrenchOrder),
  }
}
