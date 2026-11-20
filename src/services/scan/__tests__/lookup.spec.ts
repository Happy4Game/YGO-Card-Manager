import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import {
  countCards,
  findCardsBySetCode,
  loadNameIndex,
  matchingSet,
  preferredSetCodes,
  resolveCandidates,
} from '../lookup'

// Cartes FICTIVES (makeCard) : jamais de vraies données.
const dragon = makeCard()
const golem = makeCard({
  id: 10000002,
  name: 'Golem de Papier',
  sets: [
    { code: 'ZZQ-EN010', name: 'Paquet Imaginaire', rarity: 'Rare' },
    { code: 'ZZQ-FR010', name: 'Paquet Imaginaire', rarity: 'Rare' },
    { code: 'AB01-FR002', name: 'Coffret Fictif', rarity: 'Super Rare' },
  ],
  setKeys: ['ZZQ-010', 'AB01-002'],
})
// Même code qu'une autre carte (rare, mais existe) : le scan doit proposer un choix.
const twin = makeCard({
  id: 10000003,
  name: 'Magicien Imaginaire',
  sets: [{ code: 'ZZQ-FR010', name: 'Paquet Imaginaire', rarity: 'Common' }],
  setKeys: ['ZZQ-010'],
})

describe('lookup', () => {
  const db = new AppDatabase('test-scan-lookup')

  beforeEach(async () => {
    await db.cards.clear()
    await db.cards.bulkPut([dragon, golem, twin])
  })
  afterAll(async () => {
    await db.delete()
  })

  it('trouve une carte par son code, quelle que soit la région', async () => {
    expect((await findCardsBySetCode(db, 'TST-FR001')).map((card) => card.id)).toEqual([dragon.id])
    expect(await findCardsBySetCode(db, 'TST-EN001')).toHaveLength(1)
    expect(await findCardsBySetCode(db, 'TST-FR999')).toEqual([])
    expect(await findCardsBySetCode(db, 'pas un code')).toEqual([])
  })

  it('renvoie toutes les cartes partageant un code', async () => {
    const ids = (await findCardsBySetCode(db, 'ZZQ-FR010')).map((card) => card.id).sort()
    expect(ids).toEqual([golem.id, twin.id])
  })

  it('choisit le premier candidat OCR présent dans la base', async () => {
    const resolution = await resolveCandidates(db, ['ABO1-FR002', 'AB01-FR002'])
    expect(resolution?.code).toBe('AB01-FR002')
    expect(resolution?.cards.map((card) => card.id)).toEqual([golem.id])
  })

  it('garde le code lu même sans carte correspondante', async () => {
    expect(await resolveCandidates(db, ['TST-FR404'])).toEqual({ code: 'TST-FR404', cards: [] })
    expect(await resolveCandidates(db, [])).toBeUndefined()
  })

  it('retrouve le tirage du code lu, en préférant la même région', () => {
    expect(matchingSet(golem, 'ZZQ-FR010')?.code).toBe('ZZQ-FR010')
    expect(matchingSet(golem, 'ZZQ-DE010')?.code).toBe('ZZQ-EN010')
    expect(matchingSet(golem, 'TST-FR001')).toBeUndefined()
  })

  it('met les codes français en premier', () => {
    expect(preferredSetCodes(golem)).toEqual(['ZZQ-FR010', 'AB01-FR002', 'ZZQ-EN010'])
  })

  it('charge l’index des noms sans les textes', async () => {
    const index = await loadNameIndex(db)
    expect(index).toEqual([
      { id: dragon.id, name: 'Dragon de Test' },
      { id: golem.id, name: 'Golem de Papier' },
      { id: twin.id, name: 'Magicien Imaginaire' },
    ])
    expect(await countCards(db)).toBe(3)
  })
})
