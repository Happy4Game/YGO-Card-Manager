import { createPinia, setActivePinia } from 'pinia'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiFormatError, ApiHttpError, fetchAllCards, fetchDbVersion } from '@/api/ygoprodeck'
import { db } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import { toFrenchErrorMessage, useCardsStore } from '../cards'

// On remplace les appels réseau (et eux seuls) par des fonctions simulées.
vi.mock('@/api/ygoprodeck', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/api/ygoprodeck')>()
  return { ...original, fetchDbVersion: vi.fn(), fetchAllCards: vi.fn() }
})

// Base dédiée à ce fichier pour ne pas partager la base par défaut avec d'autres tests.
vi.mock('@/db/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/database')>()
  return { ...original, db: new original.AppDatabase('test-cards-store') }
})

describe('useCardsStore', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    vi.mocked(fetchDbVersion).mockReset()
    vi.mocked(fetchAllCards).mockReset()
    await db.delete()
    await db.open()
  })

  afterAll(async () => {
    await db.delete()
  })

  it('passe à « done » et met à jour le nombre de cartes', async () => {
    vi.mocked(fetchDbVersion).mockResolvedValue('1.0')
    vi.mocked(fetchAllCards).mockResolvedValue([makeCard({ id: 1 }), makeCard({ id: 2 })])
    const store = useCardsStore()

    const promise = store.sync()
    expect(store.status).toBe('syncing')
    await promise

    expect(store.status).toBe('done')
    expect(store.cardCount).toBe(2)
    expect(store.lastResult).toEqual({ status: 'updated', count: 2 })
    expect(fetchAllCards).toHaveBeenCalledWith('fr')
  })

  it('expose un message en français en cas d’erreur', async () => {
    vi.mocked(fetchDbVersion).mockRejectedValue(new TypeError('Failed to fetch'))
    const store = useCardsStore()
    await store.sync()
    expect(store.status).toBe('error')
    expect(store.errorMessage).toMatch(/connexion internet/)
  })

  it('ignore un second appel pendant une synchronisation', async () => {
    vi.mocked(fetchDbVersion).mockResolvedValue('1.0')
    vi.mocked(fetchAllCards).mockResolvedValue([makeCard()])
    const store = useCardsStore()
    await Promise.all([store.sync(), store.sync()])
    expect(fetchDbVersion).toHaveBeenCalledOnce()
  })

  it('relit le nombre de cartes en base', async () => {
    await db.cards.bulkPut([makeCard({ id: 7 })])
    const store = useCardsStore()
    await store.refreshCount()
    expect(store.cardCount).toBe(1)
  })
})

describe('toFrenchErrorMessage', () => {
  it.each([
    [new ApiHttpError(500), /HTTP 500/],
    [new ApiFormatError('x'), /inattendue/],
    [Object.assign(new Error('plein'), { name: 'QuotaExceededError' }), /stockage/],
    [new Error('autre'), /a échoué/],
    ['pas une erreur', /a échoué/],
  ])('traduit %s', (error, expected) => {
    expect(toFrenchErrorMessage(error)).toMatch(expected)
  })
})
