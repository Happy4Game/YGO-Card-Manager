import { describe, expect, it, vi } from 'vitest'
import { estimateUsage, requestPersistence } from '../storagePersistence'

function fakeStorage(overrides: Partial<StorageManager>): StorageManager {
  return overrides as StorageManager
}

describe('requestPersistence', () => {
  it('renvoie unsupported sans API', async () => {
    expect(await requestPersistence(undefined)).toBe('unsupported')
  })

  it('ne redemande pas si déjà persistant', async () => {
    const persist = vi.fn()
    const storage = fakeStorage({ persisted: async () => true, persist })
    expect(await requestPersistence(storage)).toBe('persisted')
    expect(persist).not.toHaveBeenCalled()
  })

  it('demande la persistance sinon', async () => {
    const storage = fakeStorage({ persisted: async () => false, persist: async () => false })
    expect(await requestPersistence(storage)).toBe('not-persisted')
  })
})

describe('estimateUsage', () => {
  it('renvoie usage et quota', async () => {
    const storage = fakeStorage({ estimate: async () => ({ usage: 10, quota: 100 }) })
    expect(await estimateUsage(storage)).toEqual({ usedBytes: 10, quotaBytes: 100 })
  })
})
