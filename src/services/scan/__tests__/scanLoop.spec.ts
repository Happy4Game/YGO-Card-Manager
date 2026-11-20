import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createScanLoop } from '../scanLoop'

describe('createScanLoop', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('appelle l’étape à intervalle régulier puis s’arrête', async () => {
    const step = vi.fn(() => Promise.resolve())
    const loop = createScanLoop(step, { intervalMs: 600 })
    loop.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(step).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(600)
    expect(step).toHaveBeenCalledTimes(2)
    loop.stop()
    expect(loop.running).toBe(false)
    await vi.advanceTimersByTimeAsync(3000)
    expect(step).toHaveBeenCalledTimes(2)
  })

  it('n’empile jamais deux étapes : attend la fin de la lecture en cours', async () => {
    let active = 0
    let maxActive = 0
    const step = vi.fn(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 1000))
      active -= 1
    })
    const loop = createScanLoop(step, { intervalMs: 100 })
    loop.start()
    loop.start() // un second démarrage ne crée pas de seconde boucle
    await vi.advanceTimersByTimeAsync(5000)
    loop.stop()
    expect(maxActive).toBe(1)
    expect(step.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('continue après une erreur et la signale', async () => {
    const onError = vi.fn()
    const step = vi.fn(() => Promise.reject(new Error('OCR en panne')))
    const loop = createScanLoop(step, { intervalMs: 100, onError })
    loop.start()
    await vi.advanceTimersByTimeAsync(250)
    loop.stop()
    expect(onError).toHaveBeenCalled()
    expect(step.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
