/**
 * Codes d'impression, ex. « LOB-FR001 », « SDK-E005 », « RA01-EN054 ».
 * Format : préfixe du set (2 à 5 caractères), tiret, code région facultatif (0 à 2 lettres),
 * numéro à 3 chiffres. La région change selon la langue de la carte (FR, EN, DE…) : pour
 * retrouver une carte, on compare une « clé » sans région, ex. « LOB-001 ».
 */
const SET_CODE = /\b([A-Z0-9]{2,5})-([A-Z]{0,2})(\d{3})\b/

export interface ParsedSetCode {
  prefix: string
  region: string
  number: string
}

/** Trouve le premier code d'impression dans un texte (insensible à la casse). */
export function parseSetCode(text: string): ParsedSetCode | undefined {
  const match = SET_CODE.exec(text.toUpperCase())
  if (!match) return undefined
  const [, prefix = '', region = '', number = ''] = match
  return { prefix, region, number }
}

/** Clé de comparaison indépendante de la langue, ex. « LOB-FR001 » → « LOB-001 ». */
export function setCodeKey(code: string): string | undefined {
  const parsed = parseSetCode(code)
  return parsed ? `${parsed.prefix}-${parsed.number}` : undefined
}

/** Le texte entier est-il un code d'impression valide (ex. « LOB-FR001 », « MP23-FR045 ») ? */
export function isSetCode(text: string): boolean {
  return /^[A-Z0-9]{2,5}-[A-Z]{0,2}\d{3}$/.test(text.trim().toUpperCase())
}
