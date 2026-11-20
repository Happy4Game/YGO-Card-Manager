import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import { listFilterOptions, normalizeText, searchCards } from '../cardSearch'

const db = new AppDatabase('test-card-search')

// Jeu de cartes fictives.
const cards = [
  makeCard({ id: 1, name: 'Élan Électrique', race: 'Thunder', attribute: 'LIGHT' }),
  makeCard({
    id: 2,
    name: 'Golem de Pierre',
    race: 'Rock',
    attribute: 'EARTH',
    archetype: 'Golem',
  }),
  makeCard({ id: 3, name: 'Golem Brisé', race: 'Rock', attribute: 'EARTH', archetype: 'Golem' }),
  makeCard({
    id: 4,
    name: 'Rituel Imaginaire',
    type: 'Spell Card',
    race: 'Ritual',
    attribute: undefined,
    atk: undefined,
    def: undefined,
    level: undefined,
  }),
  makeCard({ id: 5, name: 'Électron Libre', race: 'Thunder', attribute: 'DARK' }),
]

describe('normalizeText', () => {
  it('retire accents et majuscules', () => {
    expect(normalizeText('Élan ÉLECTRIQUE çà')).toBe('elan electrique ca')
  })
})

beforeAll(async () => {
  await db.cards.bulkPut(cards)
})

afterAll(async () => {
  await db.delete()
})

describe('searchCards', () => {
  it('renvoie toutes les cartes triées par nom sans filtre', async () => {
    const { items, total } = await searchCards(db, {})
    expect(total).toBe(5)
    expect(items.map((c) => c.id)).toEqual([3, 2, 4, 1, 5])
  })

  it('cherche une sous-chaîne sans tenir compte des accents ni de la casse', async () => {
    const { items } = await searchCards(db, { name: '  ELEC ' })
    expect(items.map((c) => c.id).sort()).toEqual([1, 5])
  })

  it('combine les filtres', async () => {
    const { items, total } = await searchCards(db, {
      name: 'golem',
      race: 'Rock',
      attribute: 'EARTH',
      archetype: 'Golem',
    })
    expect(total).toBe(2)
    expect(items.map((c) => c.id)).toEqual([3, 2])
    expect((await searchCards(db, { type: 'Spell Card' })).total).toBe(1)
    expect((await searchCards(db, { attribute: 'DARK', race: 'Rock' })).total).toBe(0)
  })

  it('pagine les résultats en conservant le total', async () => {
    const first = await searchCards(db, {}, { limit: 2, offset: 0 })
    const last = await searchCards(db, {}, { limit: 2, offset: 4 })
    expect(first).toMatchObject({ total: 5 })
    expect(first.items.map((c) => c.id)).toEqual([3, 2])
    expect(last.items.map((c) => c.id)).toEqual([5])
  })

  it('applique la pagination après les filtres', async () => {
    const { items, total } = await searchCards(db, { race: 'Thunder' }, { limit: 1, offset: 1 })
    expect(total).toBe(2)
    expect(items.map((c) => c.id)).toEqual([5])
  })
})

describe('listFilterOptions', () => {
  it('liste les valeurs distinctes triées', async () => {
    await expect(listFilterOptions(db)).resolves.toEqual({
      types: ['Normal Monster', 'Spell Card'],
      attributes: ['DARK', 'EARTH', 'LIGHT'],
      races: ['Ritual', 'Rock', 'Thunder'],
    })
  })
})
