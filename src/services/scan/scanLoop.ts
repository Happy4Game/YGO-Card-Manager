/**
 * Boucle de lecture continue : une image toutes les ~600 ms, jamais deux OCR en parallèle.
 * On attend la fin d'une lecture avant de programmer la suivante (setTimeout plutôt que
 * setInterval) : un téléphone lent ne s'engorge pas.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/setTimeout
 */
export interface ScanLoop {
  start(): void
  stop(): void
  readonly running: boolean
}

export function createScanLoop(
  step: () => Promise<void>,
  options: { intervalMs?: number; onError?: (error: unknown) => void } = {},
): ScanLoop {
  const { intervalMs = 600, onError } = options
  let running = false
  let timer: ReturnType<typeof setTimeout> | undefined
  // Chaque démarrage a son numéro : une lecture lancée avant un arrêt ne relance rien.
  let generation = 0

  const schedule = (delay: number, run: number) => {
    timer = setTimeout(() => {
      void tick(run)
    }, delay)
  }

  async function tick(run: number) {
    if (!running || run !== generation) return
    const startedAt = Date.now()
    try {
      await step()
    } catch (error) {
      onError?.(error)
    }
    if (running && run === generation) {
      schedule(Math.max(0, intervalMs - (Date.now() - startedAt)), run)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      generation += 1
      schedule(0, generation)
    },
    stop() {
      running = false
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
    },
    get running() {
      return running
    },
  }
}
