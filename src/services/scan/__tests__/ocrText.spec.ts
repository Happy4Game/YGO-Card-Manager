import { describe, expect, it } from 'vitest'
import { candidateKeys, normalizeManualCode, normalizeOcrText, setCodeCandidates } from '../ocrText'

// Codes FICTIFS uniquement (préfixes inventés : TST, ZZQ, AB12…).

describe('normalizeOcrText', () => {
  it('met en majuscules et unifie les tirets', () => {
    expect(normalizeOcrText(' tst – fr001\n')).toBe('TST-FR001')
    expect(normalizeOcrText('TST_FR001')).toBe('TST-FR001')
    expect(normalizeOcrText('«TST-FR001»')).toBe('TST-FR001')
  })
})

describe('setCodeCandidates', () => {
  it('lit un code propre', () => {
    expect(setCodeCandidates('TST-FR001')[0]).toBe('TST-FR001')
  })

  it('corrige les lettres lues dans le numéro (O→0, I→1, S→5, B→8)', () => {
    expect(setCodeCandidates('TST-FRO01')[0]).toBe('TST-FR001')
    expect(setCodeCandidates('TST-FR0I5')[0]).toBe('TST-FR015')
    expect(setCodeCandidates('TST-ENS0B')[0]).toBe('TST-EN508')
  })

  it('corrige les chiffres lus dans la région (0→O, 1→I, 5→S, 8→B)', () => {
    expect(setCodeCandidates('TST-F8001')).toEqual([])
    expect(setCodeCandidates('TST-5P001')[0]).toBe('TST-SP001')
    expect(setCodeCandidates('TST-1T001')[0]).toBe('TST-IT001')
  })

  it('propose aussi une variante du préfixe avec chiffres (validée ensuite par la base)', () => {
    const candidates = setCodeCandidates('ABO1-EN054')
    expect(candidates[0]).toBe('ABO1-EN054')
    expect(candidates).toContain('AB01-EN054')
  })

  it('propose une variante tout en lettres du préfixe', () => {
    expect(setCodeCandidates('T5T-FR001')).toContain('TST-FR001')
  })

  it('accepte les codes sans région et à une lettre', () => {
    expect(setCodeCandidates('TST-001')[0]).toBe('TST-001')
    expect(setCodeCandidates('ZZQ-E005')[0]).toBe('ZZQ-E005')
  })

  it('retrouve un code dont le tiret a été perdu ou des espaces ajoutés', () => {
    expect(setCodeCandidates('TSTFR001')).toContain('TST-FR001')
    expect(setCodeCandidates('TST-FR 001')[0]).toBe('TST-FR001')
  })

  it('retire un caractère lu en double (observé avec le vrai moteur)', () => {
    expect(setCodeCandidates('TST-FR0O01')[0]).toBe('TST-FR001')
    expect(setCodeCandidates('TST-FRR001')[0]).toBe('TST-FR001')
    expect(setCodeCandidates('TST-FRXY01')).toEqual([])
  })

  it('ignore le bruit autour du code', () => {
    expect(setCodeCandidates('~ 1st Edition  TST-FR001 ..')[0]).toBe('TST-FR001')
  })

  it('refuse une région inconnue ou un texte sans code', () => {
    expect(setCodeCandidates('TST-XY001')).toEqual([])
    expect(setCodeCandidates('ATK/2500 DEF/2000')).toEqual([])
    expect(setCodeCandidates('')).toEqual([])
  })
})

describe('candidateKeys', () => {
  it('donne les clés sans région, sans doublon', () => {
    expect(candidateKeys(['TST-FR001', 'TST-EN001', 'TST-FR002'])).toEqual(['TST-001', 'TST-002'])
  })
})

describe('normalizeManualCode', () => {
  it('normalise une saisie au clavier', () => {
    expect(normalizeManualCode('tst-fr001')).toBe('TST-FR001')
    expect(normalizeManualCode('tst fr001')).toBe('TST-FR001')
    expect(normalizeManualCode('n’importe quoi')).toBeUndefined()
  })
})
