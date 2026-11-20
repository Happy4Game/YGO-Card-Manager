import { describe, expect, it } from 'vitest'
import {
  addRecentScan,
  loadRecentScans,
  MAX_RECENT_SCANS,
  RECENT_SCANS_KEY,
  saveRecentScans,
  type RecentScan,
} from '../recentScans'

const scan = (cardId: number, code = 'TST-FR001', at = 1): RecentScan => ({
  cardId,
  name: `Carte fictive ${String(cardId)}`,
  code,
  at,
})

function memoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
  }
}

describe('recentScans', () => {
  it('ajoute en tête et fait remonter un doublon', () => {
    const list = addRecentScan(addRecentScan([], scan(1)), scan(2))
    expect(list.map((item) => item.cardId)).toEqual([2, 1])
    expect(addRecentScan(list, scan(1, 'TST-FR001', 5)).map((item) => item.cardId)).toEqual([1, 2])
    expect(addRecentScan(list, scan(1, 'TST-EN001'))).toHaveLength(3)
  })

  it('limite la taille de la liste', () => {
    let list: RecentScan[] = []
    for (let id = 0; id < MAX_RECENT_SCANS + 5; id += 1) list = addRecentScan(list, scan(id))
    expect(list).toHaveLength(MAX_RECENT_SCANS)
  })

  it('sauvegarde et relit la liste', () => {
    const storage = memoryStorage()
    saveRecentScans(storage, [scan(1), scan(2)])
    expect(loadRecentScans(storage)).toEqual([scan(1), scan(2)])
  })

  it('ignore un contenu corrompu ou un stockage indisponible', () => {
    const storage = memoryStorage()
    storage.setItem(RECENT_SCANS_KEY, '{pas du json')
    expect(loadRecentScans(storage)).toEqual([])
    storage.setItem(RECENT_SCANS_KEY, JSON.stringify([scan(1), { cardId: 'x' }]))
    expect(loadRecentScans(storage)).toEqual([scan(1)])
    expect(loadRecentScans(undefined)).toEqual([])

    const throwing = {
      getItem: () => {
        throw new Error('bloqué')
      },
      setItem: () => {
        throw new Error('quota')
      },
    }
    expect(loadRecentScans(throwing)).toEqual([])
    expect(() => saveRecentScans(throwing, [scan(1)])).not.toThrow()
  })
})
