import { parseSetCode, setCodeKey } from '@/domain/setCode'

/**
 * Post-traitement du texte lu par l'OCR pour retrouver un code d'impression.
 *
 * L'OCR confond souvent des caractères qui se ressemblent (O/0, I/1, S/5, B/8…). On corrige
 * selon la position : le numéro final est toujours en chiffres, le code région en lettres.
 * Le préfixe du set peut légitimement mélanger lettres et chiffres (ex. « RA01 », « 5DS ») :
 * on propose donc plusieurs candidats, et c'est la base locale qui tranche.
 */

const TO_DIGIT: Record<string, string> = {
  O: '0',
  Q: '0',
  D: '0',
  I: '1',
  L: '1',
  Z: '2',
  S: '5',
  G: '6',
  B: '8',
}

const TO_LETTER: Record<string, string> = {
  '0': 'O',
  '1': 'I',
  '2': 'Z',
  '4': 'A',
  '5': 'S',
  '6': 'G',
  '8': 'B',
}

/** Codes région connus (cartes européennes, asiatiques et anciennes éditions à une lettre). */
export const KNOWN_REGIONS: ReadonlySet<string> = new Set([
  '',
  'EN',
  'E',
  'FR',
  'F',
  'DE',
  'G',
  'D',
  'IT',
  'I',
  'PT',
  'P',
  'SP',
  'S',
  'JP',
  'J',
  'KR',
  'K',
  'AE',
  'A',
  'TC',
  'SC',
])

const toDigits = (text: string) =>
  [...text].map((char) => (/\d/.test(char) ? char : (TO_DIGIT[char] ?? char))).join('')
const toLetters = (text: string) =>
  [...text].map((char) => (/[A-Z]/.test(char) ? char : (TO_LETTER[char] ?? char))).join('')

/** Majuscules, tirets typographiques et séparateurs parasites ramenés à « - ». */
export function normalizeOcrText(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[‐‑‒–—―−_~=]/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/[^A-Z0-9\-\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Corrige la partie après le tiret : région (lettres) + numéro (3 chiffres). */
function fixSuffix(suffix: string): { region: string; number: string } | undefined {
  if (suffix.length < 3 || suffix.length > 5) return undefined
  const number = toDigits(suffix.slice(-3))
  const region = toLetters(suffix.slice(0, -3))
  if (!/^\d{3}$/.test(number) || !/^[A-Z]{0,2}$/.test(region)) return undefined
  return { region, number }
}

/**
 * Un caractère lu en double est une erreur d'OCR fréquente (« FR0O01 » pour « FR001 ») :
 * au-delà de 5 caractères, on essaie de retirer l'un de deux voisins qui se ressemblent.
 */
function suffixVariants(suffix: string): string[] {
  if (suffix.length <= 5) return [suffix]
  const variants: string[] = []
  for (let i = 0; i + 1 < suffix.length; i += 1) {
    const [a = '', b = ''] = [suffix[i], suffix[i + 1]]
    if (toDigits(a) === toDigits(b)) {
      const variant = suffix.slice(0, i) + suffix.slice(i + 1)
      if (!variants.includes(variant)) variants.push(variant)
    }
  }
  return variants
}

/**
 * Liste ordonnée (meilleur d'abord, sans doublon) des codes d'impression plausibles dans un texte
 * OCR. Ex. « LOB-FRO01 » → [« LOB-FR001 », …] ; « RAO1-EN054 » → [« RAO1-EN054 », « RA01-EN054 »].
 */
export function setCodeCandidates(raw: string): string[] {
  const text = normalizeOcrText(raw)
  const candidates = collectCandidates(text)
  // L'OCR insère parfois des espaces dans le code (« LOB-FR 001 ») : second essai sans espaces.
  return candidates.length > 0 ? candidates : collectCandidates(text.replace(/ /g, ''))
}

function collectCandidates(text: string): string[] {
  const candidates: string[] = []
  const add = (prefix: string, region: string, number: string) => {
    const code = `${prefix}-${region}${number}`
    if (parseSetCode(code) && !candidates.includes(code)) candidates.push(code)
  }
  const addAllPrefixes = (prefix: string, region: string, number: string) => {
    if (!KNOWN_REGIONS.has(region)) return
    add(prefix, region, number)
    // Préfixe : on garde la lecture brute, puis tout en lettres, puis des chiffres après les
    // deux premières lettres (« RAO1 » → « RA01 »). La base locale dira lequel existe.
    add(toLetters(prefix), region, number)
    add(prefix.slice(0, 2) + toDigits(prefix.slice(2)), region, number)
  }

  // 1. Forme attendue : PRÉFIXE-SUFFIXE.
  for (const match of text.matchAll(/([A-Z0-9]{2,5})-([A-Z0-9]{3,6})(?![A-Z0-9])/g)) {
    const [, prefix = '', suffix = ''] = match
    for (const variant of suffixVariants(suffix)) {
      const fixed = fixSuffix(variant)
      if (fixed) addAllPrefixes(prefix, fixed.region, fixed.number)
    }
  }

  // 2. Tiret perdu par l'OCR : « LOBFR001 ». On cherche une région connue suivie de 3 chiffres.
  if (candidates.length === 0) {
    for (const word of text.split(/[\s-]+/)) {
      if (word.length < 6 || word.length > 10) continue
      for (const regionLength of [2, 1]) {
        const prefixLength = word.length - 3 - regionLength
        if (prefixLength < 2 || prefixLength > 5) continue
        const fixed = fixSuffix(word.slice(prefixLength))
        if (fixed && fixed.region.length === regionLength) {
          addAllPrefixes(word.slice(0, prefixLength), fixed.region, fixed.number)
        }
      }
    }
  }
  return candidates
}

/** Clés de recherche (sans région) des candidats, sans doublon, dans le même ordre. */
export function candidateKeys(candidates: readonly string[]): string[] {
  const keys: string[] = []
  for (const code of candidates) {
    const key = setCodeKey(code)
    if (key && !keys.includes(key)) keys.push(key)
  }
  return keys
}

/** Normalise une saisie manuelle (« lob fr001 » → « LOB-FR001 »), ou undefined si illisible. */
export function normalizeManualCode(input: string): string | undefined {
  return setCodeCandidates(input)[0]
}
