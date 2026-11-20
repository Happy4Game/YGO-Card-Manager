import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { makeCard } from '@/test/fixtures'
import { parseQuery } from '../queryParser'
import { SearchEngine, type SortOption } from '../searchEngine'

// Cartes FICTIVES uniquement (règle légale du projet).
const cards: CardData[] = [
  makeCard({
    id: 1,
    name: 'Dragon',
    nameEn: 'Test Wyvern',
    race: 'Dragon',
    atk: 2400,
    def: 2000,
    level: 7,
    desc: 'Un dragon fictif.',
  }),
  makeCard({
    id: 2,
    name: 'Dragon Blanc Fictif',
    type: 'Effect Monster',
    race: 'Dragon',
    attribute: 'LIGHT',
    atk: 3000,
    def: 2500,
    level: 8,
    archetype: 'Fictif',
    desc: 'Quand cette carte est invoquée, piochez 1 carte.',
    sets: [
      { code: 'TST-FR001', name: 'Boîte de Test', rarity: 'Ultra Rare' },
      { code: 'TST-EN001', name: 'Test Box', rarity: 'Ultra Rare' },
      { code: 'AUT-FR010', name: 'Autre Série', rarity: 'Common' },
    ],
    setKeys: ['TST-001', 'AUT-010'],
  }),
  makeCard({
    id: 3,
    name: 'Élan Électrique',
    nameEn: 'Electric Moose',
    race: 'Thunder',
    attribute: 'LIGHT',
    atk: 1200,
    def: 800,
    level: 3,
    desc: 'Inflige des dégâts au dragon adverse.',
    sets: [{ code: 'AUT-FR002', name: 'Autre Série', rarity: 'Secret Rare' }],
    setKeys: ['AUT-002'],
  }),
  makeCard({
    id: 4,
    name: 'Sort de Pioche',
    nameEn: 'Draw Spell',
    type: 'Spell Card',
    frameType: 'spell',
    race: 'Quick-Play',
    attribute: undefined,
    atk: undefined,
    def: undefined,
    level: undefined,
    desc: 'Piochez 2 cartes.',
    sets: [{ code: 'TST-FR002', name: 'Boîte de Test', rarity: 'Common' }],
    setKeys: ['TST-002'],
  }),
  makeCard({
    id: 5,
    name: 'Cyber Lien Fictif',
    type: 'Link Monster',
    frameType: 'link',
    race: 'Cyberse',
    attribute: 'DARK',
    atk: 2300,
    def: undefined,
    level: undefined,
    linkval: 3,
    linkmarkers: ['Top', 'Bottom-Left', 'Bottom-Right'],
    sets: [],
    setKeys: [],
  }),
  makeCard({
    id: 6,
    name: 'Abeille XYZ',
    type: 'XYZ Monster',
    frameType: 'xyz',
    race: 'Insect',
    attribute: 'WIND',
    atk: 2000,
    def: 1500,
    level: 4,
    sets: [],
    setKeys: [],
  }),
  makeCard({
    id: 7,
    name: 'Zèbre Pendule',
    type: 'Pendulum Effect Monster',
    frameType: 'effect_pendulum',
    race: 'Beast',
    attribute: 'EARTH',
    atk: 1000,
    def: 1000,
    level: 4,
    scale: 5,
    sets: [],
    setKeys: [],
  }),
  makeCard({
    id: 8,
    name: 'Écureuil Normal',
    race: 'Beast',
    attribute: 'EARTH',
    atk: 500,
    def: 500,
    level: 2,
    sets: [],
    setKeys: [],
  }),
]

const db = new AppDatabase('test-search-engine')
let engine: SearchEngine

async function ids(input: string, sort: SortOption = 'relevance'): Promise<number[]> {
  const { hits } = await engine.search(parseQuery(input).query, { sort, limit: 100 })
  return hits.map((hit) => hit.card.id)
}

beforeAll(async () => {
  await db.cards.bulkPut(cards)
})

beforeEach(async () => {
  await db.collection.clear()
  engine = new SearchEngine(db)
})

afterAll(async () => {
  await db.delete()
})

describe('texte libre et pertinence', () => {
  it('nom exact > commence par > contient > texte', async () => {
    // 1 : nom exact ; 2 : commence par ; 3 : « dragon » seulement dans le texte.
    expect(await ids('dragon')).toEqual([1, 2, 3])
  })

  it('tous les mots doivent correspondre, en début de mot', async () => {
    expect(await ids('dragon blanc')).toEqual([2])
    // « fict » est aussi au début d'un mot du texte de la carte 1, classée après.
    expect(await ids('drag fict')).toEqual([2, 1])
    expect(await ids('dragon licorne')).toEqual([])
  })

  it('ignore accents et casse', async () => {
    expect(await ids('ELAN electrique')).toEqual([3])
    expect(await ids('zebre')).toEqual([7])
  })

  it('cherche aussi le nom anglais, un peu moins bien classé', async () => {
    const { hits } = await engine.search(parseQuery('moose').query)
    expect(hits.map((h) => h.card.id)).toEqual([3])
    expect(hits[0]?.matchedEnglish).toBe(true)
    expect(await ids('wyvern')).toEqual([1])
    const french = await engine.search(parseQuery('élan').query)
    expect(french.hits[0]?.matchedEnglish).toBe(false)
  })

  it('en: ne regarde que le nom anglais', async () => {
    expect(await ids('en:draw')).toEqual([4])
    expect(await ids('en:pioche')).toEqual([])
    // Sans nom anglais distinct, le nom est le même dans les deux langues.
    expect(await ids('en:abeille')).toEqual([6])
  })

  it('expression exacte et exclusion', async () => {
    expect(await ids('"piochez 1"')).toEqual([2])
    expect(await ids('dragon -blanc')).toEqual([1, 3])
    expect(await ids('pioch -"2 cartes"')).toEqual([2])
  })

  it('le texte ne correspond qu’en début de mot', async () => {
    // « arte » est dans « carte » mais ne commence aucun mot.
    expect(await ids('texte:arte')).toEqual([])
    expect(await ids('texte:cart')).toEqual([2, 4])
  })
})

describe('identifiants', () => {
  it('passcode', async () => {
    expect(await ids('#5')).toEqual([5])
    expect(await ids('id:2 #4')).toEqual([2, 4])
  })

  it('code d’impression avec ou sans région, et code choisi pour l’ajout', async () => {
    expect(await ids('tst-001')).toEqual([1, 2])
    const { hits } = await engine.search(parseQuery('TST-EN001').query)
    expect(hits.find((h) => h.card.id === 2)?.matchedSetCode).toBe('TST-EN001')
    const french = await engine.search(parseQuery('tst-fr001').query)
    expect(french.hits.find((h) => h.card.id === 2)?.matchedSetCode).toBe('TST-FR001')
  })

  it('utilise les index Dexie avant que le cache soit construit', async () => {
    const fresh = new SearchEngine(db)
    const { hits } = await fresh.search(parseQuery('AUT-002 #1').query)
    expect(hits.map((h) => h.card.id).sort()).toEqual([1, 3])
  })

  it('extension par préfixe, par nom, et avec rareté sur la même impression', async () => {
    expect(await ids('set:TST', 'name')).toEqual([1, 2, 4])
    expect(await ids('set:"autre serie"', 'name')).toEqual([2, 3])
    expect(await ids('set:AUT rarete:secrete')).toEqual([3])
    // Carte 2 : Ultra Rare en TST, Common en AUT → pas « AUT en Ultra Rare ».
    expect(await ids('set:AUT rarity:ultra')).toEqual([])
    expect(await ids('rarete:ultra')).toEqual([2])
  })
})

describe('filtres', () => {
  it('type, attribut, race en français', async () => {
    expect(await ids('type:magie')).toEqual([4])
    expect(await ids('type:xyz')).toEqual([6])
    expect(await ids('type:lien')).toEqual([5])
    expect(await ids('type:effet', 'name')).toEqual([2, 7])
    expect(await ids('type:pendule')).toEqual([7])
    expect(await ids('-type:monstre')).toEqual([4])
    expect(await ids('attr:lumière', 'name')).toEqual([1, 2, 3])
    expect(await ids('attr:feu,vent')).toEqual([6])
    expect(await ids('race:bête', 'name')).toEqual([8, 7])
    expect(await ids('race:jeu-rapide')).toEqual([4])
  })

  it('« atk>=2000 type:dragon » combine ATK et type de monstre', async () => {
    expect(await ids('atk>=2000 type:dragon', 'atk')).toEqual([2, 1])
  })

  it('comparaisons et intervalles', async () => {
    expect(await ids('atk>=2400', 'atk')).toEqual([2, 1])
    expect(await ids('def<1000', 'def-asc')).toEqual([8, 3])
    expect(await ids('niv:4', 'name')).toEqual([6, 7])
    expect(await ids('niv:3-4', 'name')).toEqual([6, 3, 7])
    expect(await ids('lien:3')).toEqual([5])
    expect(await ids('echelle>=5')).toEqual([7])
  })

  it('flèches Lien : toutes exigées', async () => {
    expect(await ids('fleche:haut,bas-gauche')).toEqual([5])
    expect(await ids('fleche:haut,gauche')).toEqual([])
  })

  it('archétype', async () => {
    expect(await ids('arch:fict')).toEqual([2])
  })
})

describe('tri et pagination', () => {
  it('trie par nom à la française (accents)', async () => {
    expect(await ids('', 'name')).toEqual([6, 5, 1, 2, 8, 3, 4, 7])
    expect(await ids('', 'name-desc')).toEqual([7, 4, 3, 8, 2, 1, 5, 6])
  })

  it('les cartes sans valeur vont à la fin', async () => {
    const sorted = await ids('', 'def')
    expect(sorted.slice(-2).sort()).toEqual([4, 5])
    expect(sorted[0]).toBe(2)
  })

  it('niveau et récents', async () => {
    expect((await ids('', 'level'))[0]).toBe(2)
    expect(await ids('', 'recent')).toEqual([8, 7, 6, 5, 4, 3, 2, 1])
  })

  it('pagine en conservant le total', async () => {
    const query = parseQuery('').query
    const first = await engine.search(query, { sort: 'name', limit: 3 })
    const second = await engine.search(query, { sort: 'name', offset: 3, limit: 3 })
    expect(first.total).toBe(8)
    expect(first.hits.map((h) => h.card.id)).toEqual([6, 5, 1])
    expect(second.hits.map((h) => h.card.id)).toEqual([2, 8, 3])
  })
})

describe('collection', () => {
  it('ajoute la quantité possédée et filtre in:collection', async () => {
    const base = {
      setCode: '',
      rarity: '',
      language: 'fr',
      condition: 'Near Mint' as const,
      location: '',
      note: '',
      addedAt: '2026-01-01T00:00:00.000Z',
    }
    await db.collection.bulkAdd([
      { ...base, cardId: 3, quantity: 2 },
      { ...base, cardId: 3, quantity: 1 },
      { ...base, cardId: 6, quantity: 1 },
    ])
    const { hits, total } = await engine.search(parseQuery('in:collection').query, { sort: 'name' })
    expect(total).toBe(2)
    expect(hits.map((h) => [h.card.id, h.ownedQuantity])).toEqual([
      [6, 1],
      [3, 3],
    ])
    const all = await engine.search(parseQuery('#1').query)
    expect(all.hits[0]?.ownedQuantity).toBe(0)
  })
})

describe('cache', () => {
  it('se reconstruit quand le nombre de cartes change', async () => {
    expect(await ids('licorne')).toEqual([])
    await db.cards.put(makeCard({ id: 99, name: 'Licorne de Test', setKeys: [] }))
    expect(await ids('licorne')).toEqual([99])
    await db.cards.delete(99)
    expect(await ids('licorne')).toEqual([])
  })

  it('invalidate() relit les cartes modifiées sans changement de nombre', async () => {
    await ids('dragon')
    await db.cards.update(8, { name: 'Écureuil Renommé' })
    expect(await ids('renomme')).toEqual([])
    engine.invalidate()
    expect(await ids('renomme')).toEqual([8])
    await db.cards.update(8, { name: 'Écureuil Normal' })
  })

  it('propose les valeurs distinctes pour le mode avancé', async () => {
    const facets = await engine.facets()
    expect(facets.attributes).toEqual(['DARK', 'EARTH', 'LIGHT', 'WIND'])
    expect(facets.kinds).toEqual(['Effect', 'Link', 'Normal', 'Pendulum', 'XYZ'])
    expect(facets.spellTrapRaces).toEqual(['Quick-Play'])
    expect(facets.monsterRaces).toContain('Cyberse')
    expect(facets.archetypes).toEqual(['Fictif'])
    expect(facets.rarities).toEqual(['Common', 'Secret Rare', 'Ultra Rare'])
    expect(facets.sets).toEqual([
      { prefix: 'AUT', name: 'Autre Série' },
      { prefix: 'TST', name: 'Boîte de Test' },
    ])
  })
})

describe('performance', () => {
  const perfDb = new AppDatabase('test-search-engine-perf')
  const words = ['Dragon', 'Golem', 'Mage', 'Chevalier', 'Ombre', 'Lumière', 'Éclair', 'Tempête']
  const races = ['Dragon', 'Warrior', 'Spellcaster', 'Rock', 'Beast']

  beforeAll(async () => {
    const many: CardData[] = Array.from({ length: 12_000 }, (_, i) =>
      makeCard({
        id: 20_000_000 + i,
        name: `${words[i % words.length] ?? ''} Fictif ${words[(i * 7) % words.length] ?? ''} ${i}`,
        desc: `Texte imaginaire numéro ${i}. Piochez ${i % 3} cartes puis détruisez un monstre.`,
        race: races[i % races.length] ?? 'Dragon',
        atk: (i * 100) % 4000,
        def: (i * 50) % 3000,
        level: (i % 12) + 1,
        sets: [
          {
            code: `P${String(i % 90).padStart(2, '0')}-FR${String(i % 1000).padStart(3, '0')}`,
            name: 'Boîte',
            rarity: 'Common',
          },
        ],
        setKeys: [`P${String(i % 90).padStart(2, '0')}-${String(i % 1000).padStart(3, '0')}`],
      }),
    )
    await perfDb.cards.bulkPut(many)
  }, 60_000)

  afterAll(async () => {
    await perfDb.delete()
  })

  it('répond rapidement sur 12 000 cartes une fois le cache chaud', async () => {
    const perfEngine = new SearchEngine(perfDb)
    await perfEngine.search(parseQuery('dragon').query) // construit le cache
    const queries = [
      'dragon fictif',
      'atk>=2000 type:dragon',
      'texte:piochez -golem',
      'niv:4-8 def<1000',
      'éclair mage',
      '',
    ]
    for (const input of queries) {
      const { durationMs, total } = await perfEngine.search(parseQuery(input).query, {
        sort: 'name',
      })
      expect(total).toBeGreaterThan(0)
      // Cible réelle : < 50 ms dans un navigateur. Seuil large : jsdom et la CI sont plus lents.
      expect(durationMs).toBeLessThan(400)
    }
  }, 60_000)
})
