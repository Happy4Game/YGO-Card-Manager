import { describe, expect, it, vi } from 'vitest'
import {
  API_BASE_URL,
  ApiFormatError,
  ApiHttpError,
  InvalidCardError,
  fetchAllCards,
  fetchDbVersion,
  toCardData,
  toCardList,
  type FetchFn,
} from '../ygoprodeck'

// Objet brut fictif au format de l'API (aucune vraie carte).
const rawMonster = {
  id: 10000001,
  name: 'Golem de Test',
  type: 'Effect Monster',
  frameType: 'effect',
  desc: 'Texte fictif.',
  race: 'Rock',
  attribute: 'EARTH',
  atk: 1200,
  def: 1500,
  level: 4,
  archetype: 'Testeurs',
  card_sets: [
    { set_code: 'TST-FR001', set_name: 'Boîte de Test', set_rarity: 'Rare' },
    { set_name: 'Sans code' },
  ],
  card_images: [{ id: 10000001 }],
}

/** Faux `fetch` qui renvoie le corps JSON donné, sans aucun accès réseau. */
function fakeFetch(body: unknown, status = 200) {
  return vi.fn<FetchFn>(async () => new Response(JSON.stringify(body), { status }))
}

describe('toCardData', () => {
  it('convertit un monstre complet', () => {
    expect(toCardData(rawMonster)).toEqual({
      id: 10000001,
      name: 'Golem de Test',
      type: 'Effect Monster',
      frameType: 'effect',
      desc: 'Texte fictif.',
      race: 'Rock',
      attribute: 'EARTH',
      atk: 1200,
      def: 1500,
      level: 4,
      archetype: 'Testeurs',
      sets: [{ code: 'TST-FR001', name: 'Boîte de Test', rarity: 'Rare' }],
      setKeys: ['TST-001'],
    })
  })

  it('gère un monstre Lien et omet les champs absents', () => {
    const card = toCardData({
      id: 10000002,
      name: 'Lien de Test',
      type: 'Link Monster',
      frameType: 'link',
      desc: '',
      race: 'Cyberse',
      attribute: 'DARK',
      atk: 2000,
      linkval: 2,
      linkmarkers: ['Top', 3, 'Bottom'],
    })
    expect(card.linkval).toBe(2)
    expect(card.linkmarkers).toEqual(['Top', 'Bottom'])
    expect(card).not.toHaveProperty('def')
    expect(card).not.toHaveProperty('level')
    expect(card.sets).toEqual([])
  })

  it('ignore les champs facultatifs de mauvais type', () => {
    const card = toCardData({ id: 3, name: 'Magie de Test', type: 'Spell Card', atk: '?' })
    expect(card).not.toHaveProperty('atk')
    expect(card.race).toBe('')
    expect(card.desc).toBe('')
  })

  it.each([
    ['null', null],
    ['un tableau', []],
    ['sans id', { name: 'X', type: 'Spell Card' }],
    ['id non entier', { id: 1.5, name: 'X', type: 'Spell Card' }],
    ['id texte', { id: '1', name: 'X', type: 'Spell Card' }],
    ['sans nom', { id: 1, type: 'Spell Card' }],
    ['sans type', { id: 1, name: 'X' }],
  ])('rejette une entrée invalide (%s)', (_label, raw) => {
    expect(() => toCardData(raw)).toThrow(InvalidCardError)
  })
})

describe('toCardList', () => {
  it('ignore les entrées invalides', () => {
    const cards = toCardList([rawMonster, { id: 'oops' }, null])
    expect(cards.map((c) => c.id)).toEqual([10000001])
  })
})

describe('fetchDbVersion', () => {
  it('lit la version dans le tableau renvoyé', async () => {
    const fetchFn = fakeFetch([{ database_version: '1.23', last_update: '2026-01-01 00:00:00' }])
    await expect(fetchDbVersion(fetchFn)).resolves.toBe('1.23')
    expect(fetchFn).toHaveBeenCalledWith(`${API_BASE_URL}/checkDBVer.php`, expect.anything())
  })

  it('accepte une version numérique ou un objet seul', async () => {
    await expect(fetchDbVersion(fakeFetch({ database_version: 42 }))).resolves.toBe('42')
  })

  it.each([[[]], [{}], [[{ database_version: '' }]], ['texte']])(
    'rejette une réponse inattendue (%j)',
    async (body) => {
      await expect(fetchDbVersion(fakeFetch(body))).rejects.toBeInstanceOf(ApiFormatError)
    },
  )

  it('signale une erreur HTTP', async () => {
    const promise = fetchDbVersion(fakeFetch({ error: 'x' }, 503))
    await expect(promise).rejects.toBeInstanceOf(ApiHttpError)
    await expect(promise).rejects.toMatchObject({ status: 503 })
  })
})

describe('fetchAllCards', () => {
  it('demande la langue française et convertit les cartes', async () => {
    const fetchFn = fakeFetch({ data: [rawMonster, { invalid: true }] })
    const cards = await fetchAllCards('fr', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith(
      `${API_BASE_URL}/cardinfo.php?language=fr`,
      expect.anything(),
    )
    expect(cards).toHaveLength(1)
  })

  it("n'ajoute pas de paramètre de langue pour l'anglais", async () => {
    const fetchFn = fakeFetch({ data: [] })
    await fetchAllCards('en', fetchFn)
    expect(fetchFn).toHaveBeenCalledWith(`${API_BASE_URL}/cardinfo.php`, expect.anything())
  })

  it('rejette une réponse sans tableau data', async () => {
    await expect(fetchAllCards('fr', fakeFetch({ error: 'x' }))).rejects.toBeInstanceOf(
      ApiFormatError,
    )
  })
})
