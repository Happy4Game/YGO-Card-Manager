import { afterEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import { pickPrint, quickAdd, readDefaults, rememberDefaults, undoQuickAdd } from '../quickAdd'

const db = new AppDatabase('quick-add-test')

afterEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
})

describe('pickPrint', () => {
  const card = makeCard({
    sets: [
      { code: 'TST-EN001', name: 'A', rarity: 'Common' },
      { code: 'TST-EN050', name: 'B', rarity: 'Secret Rare' },
    ],
  })

  it('garde le code lu en retrouvant sa rareté, quelle que soit la langue', () => {
    expect(pickPrint(card, 'tst-fr050')).toEqual({ code: 'TST-FR050', rarity: 'Secret Rare' })
  })
  it('ne devine pas entre plusieurs impressions', () => {
    expect(pickPrint(card)).toEqual({ code: '', rarity: '' })
  })
  it("prend l'impression unique", () => {
    expect(pickPrint(makeCard())).toEqual({ code: 'TST-FR001', rarity: 'Common' })
  })
})

describe('quickAdd', () => {
  it('ajoute puis incrémente avec les derniers réglages, et sait annuler', async () => {
    rememberDefaults({ language: 'en', condition: 'Excellent', location: 'Classeur A' })
    const card = makeCard()
    const id = await quickAdd(db, card)
    expect(await quickAdd(db, card)).toBe(id)
    expect(await db.collection.get(id)).toMatchObject({
      quantity: 2,
      language: 'en',
      condition: 'Excellent',
      location: 'Classeur A',
      setCode: 'TST-FR001',
    })
    await undoQuickAdd(db, id)
    await undoQuickAdd(db, id)
    expect(await db.collection.count()).toBe(0)
  })

  it('retombe sur des réglages sûrs si la mémoire est corrompue', () => {
    localStorage.setItem('collection:lastDefaults', '{"condition":"Neuf++","language":"xxx"}')
    expect(readDefaults()).toEqual({ language: 'fr', condition: 'Near Mint', location: '' })
  })
})
