import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppDatabase } from '@/db/database'
import { makeCard } from '@/test/fixtures'
import {
  codesInLines,
  createDetectionTracker,
  resolveDetections,
  type ResolvedDetection,
} from '../multiScan'
import type { OcrLine } from '../ocrEngine'

const word = (text: string, x: number, y = 100) => ({
  text,
  box: { x, y, width: 80, height: 20 },
})

describe('codesInLines', () => {
  it('trouve deux codes sur une même ligne (deux cartes côte à côte), positions comprises', () => {
    const lines: OcrLine[] = [
      { text: 'TST-FR001 AUT-EN007', words: [word('TST-FR001', 100), word('AUT-EN007', 900)] },
    ]
    const found = codesInLines(lines, 2)
    expect(found.map((item) => item.candidates[0])).toEqual(['TST-FR001', 'AUT-EN007'])
    // Image agrandie ×2 avant l'OCR : on revient aux pixels de la source.
    expect(found[1]?.box).toEqual({ x: 450, y: 50, width: 40, height: 10 })
  })

  it('recolle un code coupé en deux mots et ignore le reste du texte', () => {
    const lines: OcrLine[] = [
      {
        text: 'ATK 2500 TST-FR 001',
        words: [word('ATK', 0), word('2500', 100), word('TST-FR', 200), word('001', 290)],
      },
    ]
    const [found] = codesInLines(lines)
    expect(found?.candidates[0]).toBe('TST-FR001')
    expect(found?.box).toEqual({ x: 200, y: 100, width: 170, height: 20 })
  })
})

describe('resolveDetections', () => {
  const db = new AppDatabase('multi-scan-test')
  beforeAll(async () => {
    await db.cards.add(makeCard())
  })
  afterAll(async () => {
    await db.delete()
  })

  it('reconnaît chaque carte une seule fois et garde les codes inconnus', async () => {
    const box = { x: 0, y: 0, width: 1, height: 1 }
    const resolved = await resolveDetections(db, [
      { candidates: ['TST-EN001'], box },
      { candidates: ['TST-FR001'], box },
      { candidates: ['ZZZ-FR404'], box },
    ])
    expect(resolved.map((item) => [item.key, item.cards.length])).toEqual([
      ['TST-001', 1],
      ['ZZZ-404', 0],
    ])
  })
})

describe('createDetectionTracker', () => {
  const detection = (key: string, known = true): ResolvedDetection => ({
    key,
    code: key,
    cards: known ? [makeCard()] : [],
    box: { x: 0, y: 0, width: 1, height: 1 },
  })

  it('confirme un code après deux lectures, une seule fois', () => {
    const tracker = createDetectionTracker({ required: 2 })
    expect(tracker.update([detection('A')], 0).confirmed).toEqual([])
    const second = tracker.update([detection('A'), detection('B')], 500)
    expect(second.confirmed.map((item) => item.key)).toEqual(['A'])
    expect(second.visible.map((item) => [item.key, item.confirmed])).toEqual([
      ['A', true],
      ['B', false],
    ])
    expect(tracker.update([detection('A')], 1000).confirmed).toEqual([])
  })

  it('exige une lecture de plus pour un code inconnu et oublie les codes disparus', () => {
    const tracker = createDetectionTracker({ required: 2, ttlMs: 1000 })
    tracker.update([detection('X', false)], 0)
    expect(tracker.update([detection('X', false)], 100).confirmed).toEqual([])
    expect(tracker.update([detection('X', false)], 200).confirmed).toHaveLength(1)
    // Plus vu depuis trop longtemps : le compteur repart de zéro.
    tracker.update([], 5000)
    expect(tracker.update([detection('X')], 5100).confirmed).toEqual([])
  })
})
