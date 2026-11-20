import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiFormatError } from '@/api/ygoprodeck'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import { syncCards, versionKey, type CardSyncApi } from '../cardSync'

const db = new AppDatabase('test-card-sync')

function fakeApi(version: string, cards = [makeCard()]) {
  return {
    fetchDbVersion: vi.fn<CardSyncApi['fetchDbVersion']>(async () => version),
    fetchAllCards: vi.fn<CardSyncApi['fetchAllCards']>(async () => cards),
  }
}

describe('syncCards', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  afterAll(async () => {
    await db.delete()
  })

  it('télécharge les cartes quand le cache est vide', async () => {
    const api = fakeApi('1.0', [makeCard({ id: 1 }), makeCard({ id: 2 })])
    await expect(syncCards(db, api, 'fr')).resolves.toEqual({ status: 'updated', count: 2 })
    expect(api.fetchAllCards).toHaveBeenCalledWith('fr')
    expect(await db.cards.count()).toBe(2)
    expect(await db.meta.get(versionKey('fr'))).toEqual({ key: 'dbVersion:fr', value: '1.0' })
  })

  it('ne retélécharge pas si la version est identique', async () => {
    await syncCards(db, fakeApi('1.0'), 'fr')
    const api = fakeApi('1.0')
    await expect(syncCards(db, api, 'fr')).resolves.toEqual({ status: 'up-to-date', count: 1 })
    expect(api.fetchAllCards).not.toHaveBeenCalled()
  })

  it('remplace les anciennes cartes quand la version change', async () => {
    await syncCards(db, fakeApi('1.0', [makeCard({ id: 1 }), makeCard({ id: 2 })]), 'fr')
    const result = await syncCards(db, fakeApi('2.0', [makeCard({ id: 3 })]), 'fr')
    expect(result).toEqual({ status: 'updated', count: 1 })
    expect(await db.cards.toCollection().primaryKeys()).toEqual([3])
    expect((await db.meta.get('dbVersion:fr'))?.value).toBe('2.0')
  })

  it('retélécharge si la table des cartes a été vidée', async () => {
    await syncCards(db, fakeApi('1.0'), 'fr')
    await db.cards.clear()
    const api = fakeApi('1.0')
    await expect(syncCards(db, api, 'fr')).resolves.toMatchObject({ status: 'updated' })
  })

  it('oublie la version des autres langues (une seule langue en cache)', async () => {
    await syncCards(db, fakeApi('1.0'), 'en')
    await syncCards(db, fakeApi('1.0'), 'fr')
    expect(await db.meta.get(versionKey('en'))).toBeUndefined()
    const api = fakeApi('1.0')
    await syncCards(db, api, 'en')
    expect(api.fetchAllCards).toHaveBeenCalledOnce()
  })

  it('conserve le cache si la réponse est vide', async () => {
    await syncCards(db, fakeApi('1.0'), 'fr')
    await expect(syncCards(db, fakeApi('2.0', []), 'fr')).rejects.toBeInstanceOf(ApiFormatError)
    expect(await db.cards.count()).toBe(1)
    expect((await db.meta.get('dbVersion:fr'))?.value).toBe('1.0')
  })

  it('propage les erreurs réseau sans toucher au cache', async () => {
    await syncCards(db, fakeApi('1.0'), 'fr')
    const api = fakeApi('2.0')
    api.fetchAllCards.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(syncCards(db, api, 'fr')).rejects.toBeInstanceOf(TypeError)
    expect(await db.cards.count()).toBe(1)
  })
})
