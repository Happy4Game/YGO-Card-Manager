import { afterEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import { listRarities } from '../rarities'

const db = new AppDatabase('rarities-test')

afterEach(async () => {
  await db.delete()
  await db.open()
})

describe('listRarities', () => {
  it('rassemble les raretés distinctes, triées', async () => {
    await db.cards.bulkAdd([
      makeCard({
        id: 1,
        sets: [
          { code: 'TST-FR001', name: 'A', rarity: 'Super Rare' },
          { code: 'TST-FR002', name: 'A', rarity: 'Common' },
        ],
      }),
      makeCard({ id: 2, sets: [{ code: 'TST-FR003', name: 'B', rarity: 'Common' }] }),
    ])
    expect(await listRarities(db)).toEqual(['Common', 'Super Rare'])
  })
})
