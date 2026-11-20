import { afterEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '../database'

describe('AppDatabase', () => {
  const db = new AppDatabase('test-db')

  afterEach(async () => {
    await db.delete()
    await db.open()
  })

  it('attribue un id auto-incrémenté aux entrées de collection', async () => {
    const id = await db.collection.add({
      cardId: 1,
      setCode: 'TST-FR001',
      rarity: 'Common',
      language: 'fr',
      condition: 'Near Mint',
      quantity: 2,
      location: 'Classeur A',
      note: '',
      addedAt: '2026-11-20T00:00:00.000Z',
    })
    expect(typeof id).toBe('number')
    expect(await db.collection.get(id)).toMatchObject({ quantity: 2 })
  })
})
