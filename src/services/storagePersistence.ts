/**
 * Stockage persistant : demande au navigateur de ne pas effacer IndexedDB et le cache
 * quand l'espace disque manque. Sans cela, la collection pourrait disparaître.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/StorageManager/persist
 */
export type PersistenceState = 'persisted' | 'not-persisted' | 'unsupported'

export async function requestPersistence(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<PersistenceState> {
  if (!storage?.persist || !storage.persisted) return 'unsupported'
  if (await storage.persisted()) return 'persisted'
  return (await storage.persist()) ? 'persisted' : 'not-persisted'
}

export interface StorageUsage {
  usedBytes: number
  quotaBytes: number
}

export async function estimateUsage(
  storage: StorageManager | undefined = globalThis.navigator?.storage,
): Promise<StorageUsage | null> {
  if (!storage?.estimate) return null
  const { usage, quota } = await storage.estimate()
  return { usedBytes: usage ?? 0, quotaBytes: quota ?? 0 }
}
