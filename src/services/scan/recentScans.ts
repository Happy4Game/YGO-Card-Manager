/**
 * « Scans récents » : les cartes scannées pendant cette session, pour enchaîner les ajouts.
 * Gardés en mémoire et dans sessionStorage (effacé à la fermeture de l'onglet).
 * sessionStorage peut être indisponible (navigation privée, stockage bloqué) : chaque accès
 * est protégé par try/catch et la liste fonctionne alors seulement en mémoire.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/sessionStorage
 */
export interface RecentScan {
  cardId: number
  name: string
  code: string
  /** Horodatage (ms). */
  at: number
}

export const RECENT_SCANS_KEY = 'scan:recent'
export const MAX_RECENT_SCANS = 30

function isRecentScan(value: unknown): value is RecentScan {
  if (typeof value !== 'object' || value === null) return false
  return (
    'cardId' in value &&
    typeof value.cardId === 'number' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'code' in value &&
    typeof value.code === 'string' &&
    'at' in value &&
    typeof value.at === 'number'
  )
}

export function loadRecentScans(storage: Pick<Storage, 'getItem'> | undefined): RecentScan[] {
  try {
    const raw = storage?.getItem(RECENT_SCANS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecentScan).slice(0, MAX_RECENT_SCANS) : []
  } catch {
    return []
  }
}

export function saveRecentScans(
  storage: Pick<Storage, 'setItem'> | undefined,
  scans: readonly RecentScan[],
): void {
  try {
    storage?.setItem(RECENT_SCANS_KEY, JSON.stringify(scans))
  } catch {
    // Quota dépassé ou stockage bloqué : la liste reste en mémoire.
  }
}

/** Ajoute en tête ; une même carte avec le même code remonte au lieu d'être dupliquée. */
export function addRecentScan(scans: readonly RecentScan[], scan: RecentScan): RecentScan[] {
  const others = scans.filter((item) => !(item.cardId === scan.cardId && item.code === scan.code))
  return [scan, ...others].slice(0, MAX_RECENT_SCANS)
}

/** sessionStorage si accessible (l'accès lui-même peut lever une exception). */
export function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}
