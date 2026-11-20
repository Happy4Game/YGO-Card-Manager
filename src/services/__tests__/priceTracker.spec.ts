import { afterEach, describe, expect, it, vi } from 'vitest'
import { AppDatabase } from '@/db/database'
import {
  cardmarketSearchUrl,
  formatEuros,
  getPriceHistory,
  latestPrices,
  localDay,
  refreshCollectionPrices,
} from '../priceTracker'

const db = new AppDatabase('price-tracker-test')

async function addOwned(cardId: number) {
  await db.collection.add({
    cardId,
    setCode: 'TST-FR001',
    rarity: 'Common',
    language: 'fr',
    condition: 'Near Mint',
    quantity: 1,
    location: '',
    note: '',
    addedAt: '2026-11-20T00:00:00.000Z',
  })
}

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('refreshCollectionPrices', () => {
  it('ne fait rien si la collection est vide', async () => {
    const fetchPrices = vi.fn()
    expect(await refreshCollectionPrices(db, fetchPrices)).toEqual({
      status: 'skipped',
      reason: 'empty-collection',
    })
    expect(fetchPrices).not.toHaveBeenCalled()
  })

  it('demande une seule fois chaque carte possédée et enregistre un relevé', async () => {
    await addOwned(1)
    await addOwned(1)
    await addOwned(2)
    const fetchPrices = vi.fn(async (ids: readonly number[]) =>
      ids.map((cardId) => ({ cardId, cardmarket: cardId * 1.5 })),
    )
    const now = new Date(2026, 10, 20, 10)
    expect(await refreshCollectionPrices(db, fetchPrices, { now })).toEqual({
      status: 'updated',
      count: 2,
    })
    expect(fetchPrices).toHaveBeenCalledWith([1, 2])
    expect(await getPriceHistory(db, 2)).toMatchObject([{ date: '2026-11-20', cardmarket: 3 }])
  })

  it('attend 24 h entre deux mises à jour, sauf si forcé', async () => {
    await addOwned(1)
    const fetchPrices = vi.fn(async () => [{ cardId: 1, cardmarket: 2 }])
    await refreshCollectionPrices(db, fetchPrices, { now: new Date(2026, 10, 20, 10) })
    const later = new Date(2026, 10, 20, 20)
    expect(await refreshCollectionPrices(db, fetchPrices, { now: later })).toMatchObject({
      status: 'skipped',
      reason: 'recent',
    })
    await refreshCollectionPrices(db, fetchPrices, { now: later, force: true })
    // Même jour : le relevé est remplacé, pas dupliqué.
    expect(await getPriceHistory(db, 1)).toHaveLength(1)
  })

  it("construit l'historique jour après jour et donne le dernier prix", async () => {
    await addOwned(1)
    let price = 1
    const fetchPrices = async () => [{ cardId: 1, cardmarket: price }]
    await refreshCollectionPrices(db, fetchPrices, { now: new Date(2026, 10, 20, 9) })
    price = 4
    await refreshCollectionPrices(db, fetchPrices, { now: new Date(2026, 10, 21, 10) })
    expect((await getPriceHistory(db, 1)).map((p) => p.cardmarket)).toEqual([1, 4])
    expect((await latestPrices(db, [1])).get(1)).toMatchObject({ date: '2026-11-21' })
  })
})

describe('utilitaires', () => {
  it('formate le jour local', () => {
    expect(localDay(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('formate les euros à la française', () => {
    expect(formatEuros(12.3).replace(/\s/g, ' ')).toBe('12,30 €')
  })
  it('encode le nom dans le lien Cardmarket', () => {
    expect(cardmarketSearchUrl('Dragon & Co')).toContain('searchString=Dragon+%26+Co')
  })
})
