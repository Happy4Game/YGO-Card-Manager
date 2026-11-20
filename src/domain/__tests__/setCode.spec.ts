import { describe, expect, it } from 'vitest'
import { parseSetCode, setCodeKey } from '../setCode'

describe('setCode', () => {
  it.each([
    ['TST-FR001', 'TST-001'],
    ['tst-en042', 'TST-042'],
    ['ABCD-E005', 'ABCD-005'],
    ['AB01-001', 'AB01-001'],
  ])('%s → %s', (code, key) => {
    expect(setCodeKey(code)).toBe(key)
  })

  it('trouve un code dans un texte OCR bruité', () => {
    expect(parseSetCode('xx TST-FR123 yy')).toEqual({ prefix: 'TST', region: 'FR', number: '123' })
  })

  it('renvoie undefined sans code', () => {
    expect(setCodeKey('pas de code')).toBeUndefined()
  })
})
