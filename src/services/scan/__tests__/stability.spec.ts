import { describe, expect, it } from 'vitest'
import { createStabilityTracker } from '../stability'

describe('createStabilityTracker', () => {
  it('accepte un code lu deux fois de suite', () => {
    const tracker = createStabilityTracker()
    expect(tracker.push('TST-FR001', 0)).toBeUndefined()
    expect(tracker.streak).toBe(1)
    expect(tracker.push('TST-FR001', 600)).toBe('TST-FR001')
  })

  it('repart de zéro quand un autre code est lu', () => {
    const tracker = createStabilityTracker()
    tracker.push('TST-FR001', 0)
    expect(tracker.push('TST-FR007', 600)).toBeUndefined()
    expect(tracker.push('TST-FR007', 1200)).toBe('TST-FR007')
  })

  it('ignore une image sans code au milieu d’une série', () => {
    const tracker = createStabilityTracker()
    tracker.push('TST-FR001', 0)
    expect(tracker.push(undefined, 600)).toBeUndefined()
    expect(tracker.push('TST-FR001', 1200)).toBe('TST-FR001')
  })

  it('fait expirer une série trop ancienne', () => {
    const tracker = createStabilityTracker({ maxGapMs: 1000 })
    tracker.push('TST-FR001', 0)
    expect(tracker.push('TST-FR001', 5000)).toBeUndefined()
    expect(tracker.streak).toBe(1)
  })

  it('respecte le nombre de lectures exigé et la remise à zéro', () => {
    const tracker = createStabilityTracker({ required: 3 })
    tracker.push('TST-FR001', 0)
    tracker.push('TST-FR001', 100)
    tracker.reset()
    expect(tracker.streak).toBe(0)
    tracker.push('TST-FR001', 200)
    tracker.push('TST-FR001', 300)
    expect(tracker.push('TST-FR001', 400)).toBe('TST-FR001')
  })
})
