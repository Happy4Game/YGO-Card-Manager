import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import {
  addEntry,
  changeQuantity,
  computeStats,
  CollectionError,
  findCard,
  getStats,
  groupByCard,
  listEntries,
  listLocations,
  removeEntry,
  setPrefix,
  updateEntry,
  type NewCollectionEntry,
} from '../collection'

// Données 100 % fictives (règle légale du projet : aucune vraie carte dans les tests).
function fakeCard(id: number, name: string): CardData {
  return {
    id,
    name,
    type: 'Effect Monster',
    frameType: 'effect',
    desc: 'Texte de test.',
    race: 'Warrior',
    sets: [{ code: 'TST-FR001', name: 'Extension de test', rarity: 'Common' }],
    setKeys: ['TST-001'],
  }
}

function entry(overrides: Partial<NewCollectionEntry> = {}): NewCollectionEntry {
  return {
    cardId: 11111111,
    setCode: 'TST-FR001',
    rarity: 'Common',
    language: 'fr',
    condition: 'Near Mint',
    quantity: 1,
    location: 'Classeur A',
    note: '',
    addedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('services/collection', () => {
  const db = new AppDatabase('test-collection-service')

  beforeEach(async () => {
    await db.cards.bulkAdd([
      fakeCard(11111111, 'Dragon de Démonstration'),
      fakeCard(22222222, 'Archer Imaginaire'),
    ])
  })

  afterEach(async () => {
    await db.delete()
    await db.open()
  })

  afterAll(async () => {
    await db.delete()
  })

  describe('versions distinctes', () => {
    it('une autre rareté du même code crée une version séparée', async () => {
      const common = await addEntry(db, entry())
      const secret = await addEntry(db, entry({ rarity: 'Secret Rare' }))
      expect(secret).not.toBe(common)
      // Même rareté, casse différente : même version.
      expect(await addEntry(db, entry({ rarity: 'secret rare', setCode: 'tst-fr001' }))).toBe(
        secret,
      )
      expect(await db.collection.count()).toBe(2)
    })

    it('modifier une version pour la rendre identique à une autre les fusionne', async () => {
      const common = await addEntry(db, entry({ quantity: 2 }))
      const secret = await addEntry(db, entry({ rarity: 'Secret Rare', quantity: 1 }))
      expect(await updateEntry(db, secret, { rarity: 'Common' })).toBe(common)
      expect(await db.collection.count()).toBe(1)
      expect(await db.collection.get(common)).toMatchObject({ quantity: 3 })
    })

    it('modifier une version ne touche pas les autres', async () => {
      const common = await addEntry(db, entry({ quantity: 2 }))
      const secret = await addEntry(db, entry({ rarity: 'Secret Rare' }))
      expect(await updateEntry(db, secret, { condition: 'Played' })).toBe(secret)
      expect(await db.collection.get(common)).toMatchObject({
        rarity: 'Common',
        condition: 'Near Mint',
        quantity: 2,
      })
    })

    it('groupByCard range les versions par carte avec le total et les raretés', async () => {
      await addEntry(db, entry({ quantity: 2 }))
      await addEntry(db, entry({ rarity: 'Secret Rare' }))
      await addEntry(db, entry({ cardId: 22222222 }))
      const groups = groupByCard(await listEntries(db, {}, { key: 'name', direction: 'asc' }))
      expect(groups.map((group) => [group.cardName, group.totalCopies, group.rarities])).toEqual([
        ['Archer Imaginaire', 1, ['Common']],
        ['Dragon de Démonstration', 3, ['Common', 'Secret Rare']],
      ])
      const byQuantity = groupByCard(await listEntries(db), { key: 'quantity', direction: 'desc' })
      expect(byQuantity[0]?.cardName).toBe('Dragon de Démonstration')
    })
  })

  describe('addEntry', () => {
    it('crée une entrée et nettoie les espaces', async () => {
      const id = await addEntry(db, entry({ location: '  Boîte 1 ', note: ' rare ' }))
      expect(await db.collection.get(id)).toMatchObject({
        location: 'Boîte 1',
        note: 'rare',
        quantity: 1,
      })
    })

    it('augmente la quantité d’une entrée identique au lieu de créer un doublon', async () => {
      const first = await addEntry(db, entry({ quantity: 2 }))
      const second = await addEntry(db, entry({ quantity: 3, note: 'autre note' }))
      expect(second).toBe(first)
      expect(await db.collection.count()).toBe(1)
      expect((await db.collection.get(first))?.quantity).toBe(5)
    })

    it.each([
      ['setCode', { setCode: 'TST-FR002' }],
      ['language', { language: 'en' }],
      ['condition', { condition: 'Played' as const }],
      ['location', { location: 'Classeur B' }],
    ])('crée une nouvelle entrée si %s diffère', async (_field, change) => {
      await addEntry(db, entry())
      await addEntry(db, entry(change))
      expect(await db.collection.count()).toBe(2)
    })

    it('ajoute la date du jour si elle est absente', async () => {
      const { addedAt: _ignored, ...withoutDate } = entry()
      const id = await addEntry(db, withoutDate)
      const saved = await db.collection.get(id)
      expect(Number.isNaN(Date.parse(saved?.addedAt ?? ''))).toBe(false)
    })

    it.each([0, -1, 1.5])('refuse une quantité invalide (%s)', async (quantity) => {
      await expect(addEntry(db, entry({ quantity }))).rejects.toBeInstanceOf(CollectionError)
    })

    it('refuse un identifiant de carte invalide', async () => {
      await expect(addEntry(db, entry({ cardId: 0 }))).rejects.toThrow(/identifiant/)
    })
  })

  describe('updateEntry / removeEntry', () => {
    it('modifie les champs demandés', async () => {
      const id = await addEntry(db, entry())
      await updateEntry(db, id, { location: 'Boîte 2', quantity: 4 })
      expect(await db.collection.get(id)).toMatchObject({
        id,
        location: 'Boîte 2',
        quantity: 4,
        addedAt: '2026-01-01T00:00:00.000Z',
      })
    })

    it('refuse une modification invalide sans rien changer', async () => {
      const id = await addEntry(db, entry({ quantity: 2 }))
      await expect(updateEntry(db, id, { quantity: 0 })).rejects.toBeInstanceOf(CollectionError)
      expect((await db.collection.get(id))?.quantity).toBe(2)
    })

    it('signale une entrée inexistante', async () => {
      await expect(updateEntry(db, 999, { note: 'x' })).rejects.toThrow(/n’existe plus/)
    })

    it('supprime une entrée', async () => {
      const id = await addEntry(db, entry())
      await removeEntry(db, id)
      expect(await db.collection.count()).toBe(0)
    })
  })

  describe('changeQuantity', () => {
    it('augmente et diminue la quantité', async () => {
      const id = await addEntry(db, entry({ quantity: 2 }))
      expect(await changeQuantity(db, id, 1)).toBe(3)
      expect(await changeQuantity(db, id, -2)).toBe(1)
      expect((await db.collection.get(id))?.quantity).toBe(1)
    })

    it('supprime l’entrée quand la quantité atteint 0', async () => {
      const id = await addEntry(db, entry())
      expect(await changeQuantity(db, id, -1)).toBe(0)
      expect(await db.collection.get(id)).toBeUndefined()
    })
  })

  describe('listEntries', () => {
    beforeEach(async () => {
      await addEntry(db, entry({ quantity: 3, addedAt: '2026-01-02T00:00:00.000Z' }))
      await addEntry(
        db,
        entry({
          cardId: 22222222,
          setCode: 'ABC-EN010',
          condition: 'Played',
          location: 'Boîte',
          quantity: 1,
          addedAt: '2026-01-03T00:00:00.000Z',
        }),
      )
      // Carte absente du cache local (pas encore synchronisée).
      await addEntry(
        db,
        entry({ cardId: 33333333, quantity: 2, addedAt: '2026-01-01T00:00:00.000Z' }),
      )
    })

    it('associe le nom de la carte, ou un nom de repli si elle est inconnue', async () => {
      const items = await listEntries(db, {}, { key: 'addedAt', direction: 'asc' })
      expect(items.map((item) => [item.cardName, item.cardKnown])).toEqual([
        ['Carte #33333333', false],
        ['Dragon de Démonstration', true],
        ['Archer Imaginaire', true],
      ])
    })

    it('filtre sur le nom sans tenir compte de la casse ni des accents', async () => {
      const items = await listEntries(db, { text: 'DEMONSTR' })
      expect(items.map((item) => item.cardId)).toEqual([11111111])
    })

    it('filtre aussi sur le code d’impression', async () => {
      const items = await listEntries(db, { text: 'abc-en' })
      expect(items.map((item) => item.cardId)).toEqual([22222222])
    })

    it('filtre par emplacement et par état', async () => {
      expect((await listEntries(db, { location: 'Boîte' })).map((i) => i.cardId)).toEqual([
        22222222,
      ])
      expect((await listEntries(db, { condition: 'Near Mint' })).map((i) => i.cardId)).toEqual([
        11111111, 33333333,
      ])
    })

    it('trie par nom, quantité et date', async () => {
      const byName = await listEntries(db, {}, { key: 'name', direction: 'asc' })
      expect(byName.map((item) => item.cardName)).toEqual([
        'Archer Imaginaire',
        'Carte #33333333',
        'Dragon de Démonstration',
      ])
      const byQuantity = await listEntries(db, {}, { key: 'quantity', direction: 'desc' })
      expect(byQuantity.map((item) => item.quantity)).toEqual([3, 2, 1])
      const byDate = await listEntries(db)
      expect(byDate.map((item) => item.cardId)).toEqual([22222222, 11111111, 33333333])
    })
  })

  describe('statistiques', () => {
    it('calcule totaux, cartes distinctes, emplacements et extensions', async () => {
      await addEntry(db, entry({ quantity: 2 }))
      await addEntry(db, entry({ language: 'en', quantity: 1 }))
      await addEntry(db, entry({ cardId: 22222222, setCode: 'ABC-EN010', location: '' }))
      await addEntry(db, entry({ cardId: 22222222, setCode: '', location: 'Boîte', quantity: 4 }))

      expect(await getStats(db)).toEqual({
        totalCopies: 8,
        distinctCards: 2,
        byLocation: [
          { label: 'Boîte', copies: 4 },
          { label: 'Classeur A', copies: 3 },
          { label: '', copies: 1 },
        ],
        bySet: [
          { label: '', copies: 4 },
          { label: 'TST', copies: 3 },
          { label: 'ABC', copies: 1 },
        ],
      })
    })

    it('renvoie des statistiques vides pour une collection vide', () => {
      expect(computeStats([])).toEqual({
        totalCopies: 0,
        distinctCards: 0,
        byLocation: [],
        bySet: [],
      })
    })

    it('extrait le préfixe d’extension', () => {
      expect(setPrefix('tst-fr001')).toBe('TST')
      expect(setPrefix('SANSTIRET')).toBe('SANSTIRET')
      expect(setPrefix('  ')).toBe('')
    })

    it('liste les emplacements distincts non vides, triés', async () => {
      await addEntry(db, entry({ location: 'Classeur B' }))
      await addEntry(db, entry({ location: 'boîte', setCode: 'X' }))
      await addEntry(db, entry({ location: 'Classeur B', setCode: 'Y' }))
      await addEntry(db, entry({ location: '', setCode: 'Z' }))
      expect(await listLocations(db)).toEqual(['boîte', 'Classeur B'])
    })
  })

  it('findCard lit le cache local et ignore un identifiant invalide', async () => {
    expect((await findCard(db, 22222222))?.name).toBe('Archer Imaginaire')
    expect(await findCard(db, 44444444)).toBeUndefined()
    expect(await findCard(db, -1)).toBeUndefined()
  })
})
