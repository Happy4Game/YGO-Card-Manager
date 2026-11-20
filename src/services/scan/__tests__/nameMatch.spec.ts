import { describe, expect, it } from 'vitest'
import { bestNameMatches, nameSimilarity, normalizeName, trigrams } from '../nameMatch'

// Noms FICTIFS uniquement.
const CARDS = [
  { id: 1, name: 'Dragon de Test' },
  { id: 2, name: 'Dragon Écarlate de Démonstration' },
  { id: 3, name: 'Magicien Imaginaire' },
  { id: 4, name: 'Œil du Gardien Fictif' },
  { id: 5, name: 'Golem de Papier' },
  { id: 6, name: 'Dragon de Texte' },
]

describe('normalizeName', () => {
  it('retire accents, ponctuation et casse', () => {
    expect(normalizeName('  Dragon Écarlate, de Démonstration ! ')).toBe(
      'dragon ecarlate de demonstration',
    )
    expect(normalizeName('Œil du Gardien')).toBe('oeil du gardien')
  })
})

describe('trigrams', () => {
  it('compte les trigrammes avec bordures', () => {
    const grams = trigrams('ab')
    expect([...grams.keys()]).toEqual(['  a', ' ab', 'ab '])
  })
})

describe('nameSimilarity', () => {
  it('vaut 1 pour deux noms identiques à l’accent près', () => {
    expect(nameSimilarity('Dragon Ecarlate', 'dragon écarlate')).toBe(1)
  })

  it('tolère quelques erreurs de lecture', () => {
    expect(nameSimilarity('Dragon de Tcst', 'Dragon de Test')).toBeGreaterThan(0.6)
    expect(nameSimilarity('Golem de Papier', 'Magicien Imaginaire')).toBeLessThan(0.3)
  })

  it('vaut 0 pour un texte vide', () => {
    expect(nameSimilarity('', 'Dragon')).toBe(0)
  })
})

describe('bestNameMatches', () => {
  it('classe la carte la plus proche en premier', () => {
    const matches = bestNameMatches('Dragon de Tesl', CARDS)
    expect(matches[0]?.id).toBe(1)
    expect(matches.map((match) => match.id)).toContain(6)
  })

  it('retrouve un nom lu sans accents et avec du bruit', () => {
    const matches = bestNameMatches('| Oeil du Gardien Fictif ~', CARDS)
    expect(matches[0]?.id).toBe(4)
  })

  it('limite le nombre de résultats et écarte les noms trop éloignés', () => {
    expect(bestNameMatches('Dragon', CARDS, { limit: 2 })).toHaveLength(2)
    expect(bestNameMatches('zzzzzz', CARDS)).toEqual([])
    expect(bestNameMatches('a', CARDS)).toEqual([])
  })
})
