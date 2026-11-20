/**
 * Validation par stabilité : on n'accepte un code que s'il a été lu à l'identique plusieurs
 * fois de suite. Une seule lecture peut être fausse (reflet, flou de bougé) ; deux lectures
 * identiques sur deux images différentes le sont rarement.
 *
 * Une image sans code lisible n'interrompt pas la série (la main bouge, un reflet passe),
 * mais une série trop ancienne expire.
 */
export interface StabilityOptions {
  /** Nombre de lectures identiques consécutives exigées. */
  required?: number
  /** Durée maximale (ms) entre deux lectures d'une même série. */
  maxGapMs?: number
}

export interface StabilityTracker {
  /** Enregistre une lecture (undefined = rien lu). Renvoie le code dès qu'il est stable. */
  push(code: string | undefined, now: number): string | undefined
  /** Nombre de lectures identiques dans la série en cours (pour un indicateur visuel). */
  readonly streak: number
  reset(): void
}

export function createStabilityTracker(options: StabilityOptions = {}): StabilityTracker {
  const { required = 2, maxGapMs = 2500 } = options
  let current: string | undefined
  let count = 0
  let lastSeen = 0

  return {
    push(code, now) {
      if (current !== undefined && now - lastSeen > maxGapMs) {
        current = undefined
        count = 0
      }
      if (code === undefined) return undefined
      if (code === current) {
        count += 1
      } else {
        current = code
        count = 1
      }
      lastSeen = now
      return count >= required ? code : undefined
    },
    get streak() {
      return count
    },
    reset() {
      current = undefined
      count = 0
    },
  }
}
