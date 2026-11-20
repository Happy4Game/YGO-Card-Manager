import type { AppDatabase } from '@/db/database'
import type { CardPrices, PricePoint } from '@/domain/price'

/** Clé `meta` de la dernière mise à jour des prix (date ISO). */
export const LAST_PRICE_REFRESH_KEY = 'prices:lastRefresh'
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export type FetchPrices = (ids: readonly number[]) => Promise<CardPrices[]>

export type PriceRefreshResult =
  | { status: 'skipped'; reason: 'recent' | 'empty-collection' }
  | { status: 'updated'; count: number }

/** Jour local au format AAAA-MM-JJ (pas toISOString, qui donne le jour UTC). */
export function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${String(date.getFullYear())}-${month}-${day}`
}

/**
 * Met à jour les prix des cartes de la collection, au plus une fois par 24 h.
 * Chaque appel ajoute (ou remplace pour le jour même) un relevé par carte : c'est ainsi que
 * l'historique se construit sur l'appareil, sans aucune source d'historique externe.
 */
export async function refreshCollectionPrices(
  db: AppDatabase,
  fetchPrices: FetchPrices,
  { now = new Date(), force = false }: { now?: Date; force?: boolean } = {},
): Promise<PriceRefreshResult> {
  const last = await db.meta.get(LAST_PRICE_REFRESH_KEY)
  if (!force && last && now.getTime() - new Date(last.value).getTime() < ONE_DAY_MS) {
    return { status: 'skipped', reason: 'recent' }
  }

  const cardIds = [...new Set((await db.collection.toArray()).map((entry) => entry.cardId))]
  if (cardIds.length === 0) return { status: 'skipped', reason: 'empty-collection' }

  const prices = await fetchPrices(cardIds)
  const date = localDay(now)
  await db.transaction('rw', db.priceHistory, db.meta, async () => {
    for (const price of prices) {
      const existing = await db.priceHistory
        .where('[cardId+date]')
        .equals([price.cardId, date])
        .first()
      const point: PricePoint = { cardId: price.cardId, date, cardmarket: price.cardmarket }
      if (existing?.id !== undefined) await db.priceHistory.update(existing.id, point)
      else await db.priceHistory.add(point)
    }
    await db.meta.put({ key: LAST_PRICE_REFRESH_KEY, value: now.toISOString() })
  })
  return { status: 'updated', count: prices.length }
}

/** Relevés d'une carte, du plus ancien au plus récent. */
export async function getPriceHistory(db: AppDatabase, cardId: number): Promise<PricePoint[]> {
  const points = await db.priceHistory.where('cardId').equals(cardId).toArray()
  return points.sort((a, b) => a.date.localeCompare(b.date))
}

/** Dernier prix connu de chaque carte demandée. */
export async function latestPrices(
  db: AppDatabase,
  cardIds: readonly number[],
): Promise<Map<number, PricePoint>> {
  const points = await db.priceHistory
    .where('cardId')
    .anyOf([...cardIds])
    .toArray()
  const latest = new Map<number, PricePoint>()
  for (const point of points) {
    const current = latest.get(point.cardId)
    if (!current || point.date > current.date) latest.set(point.cardId, point)
  }
  return latest
}

/**
 * Lien vers la recherche Cardmarket : la fiche Cardmarket affiche sa propre courbe de prix
 * officielle. On ne fait qu'un lien, on ne copie aucune donnée de leur site.
 */
export function cardmarketSearchUrl(cardName: string): string {
  const params = new URLSearchParams({ searchString: cardName })
  return `https://www.cardmarket.com/fr/YuGiOh/Products/Search?${params.toString()}`
}

/** Format monétaire français, ex. « 12,30 € ». */
export function formatEuros(value: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(value)
}
