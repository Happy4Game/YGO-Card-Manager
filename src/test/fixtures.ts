import type { CardData } from '@/domain/card'

/**
 * Fabrique une carte FICTIVE pour les tests (règle légale : jamais de vrais noms ni textes).
 */
export function makeCard(overrides: Partial<CardData> = {}): CardData {
  return {
    id: 10000001,
    name: 'Dragon de Test',
    type: 'Normal Monster',
    frameType: 'normal',
    desc: 'Un monstre imaginaire utilisé uniquement dans les tests.',
    race: 'Dragon',
    attribute: 'LIGHT',
    atk: 1000,
    def: 800,
    level: 4,
    sets: [{ code: 'TST-FR001', name: 'Boîte de Test', rarity: 'Common' }],
    setKeys: ['TST-001'],
    ...overrides,
  }
}

/** Dernier élément d'une liste (équivalent de `Array.prototype.at(-1)`, absent de la lib TS des tests). */
export function lastOf<T>(list: readonly T[] | undefined): T | undefined {
  return list === undefined ? undefined : list[list.length - 1]
}
