/**
 * Rapprochement approximatif d'un nom lu par l'OCR avec les noms des cartes connues.
 *
 * Méthode : coefficient de Dice sur les trigrammes (suites de 3 caractères). Il tolère bien les
 * lettres mal lues ou manquantes, et reste rapide sur ~12 000 noms.
 * Référence : https://fr.wikipedia.org/wiki/Indice_de_S%C3%B8rensen-Dice
 */

/** Minuscules, sans accents ni ponctuation : « Dragon Blanc aux Yeux Bleus » → « dragon blanc… ». */
export function normalizeName(text: string): string {
  return (
    text
      // NFD sépare la lettre de son accent, qu'on retire ensuite (plage Unicode des diacritiques).
      // Doc MDN : https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/œ/g, 'oe')
      .replace(/æ/g, 'ae')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  )
}

/** Trigrammes d'un texte normalisé, avec des espaces de bordure pour compter les débuts de mots. */
export function trigrams(normalized: string): Map<string, number> {
  const grams = new Map<string, number>()
  const padded = `  ${normalized} `
  for (let i = 0; i + 3 <= padded.length; i += 1) {
    const gram = padded.slice(i, i + 3)
    grams.set(gram, (grams.get(gram) ?? 0) + 1)
  }
  return grams
}

function diceFromGrams(a: Map<string, number>, b: Map<string, number>): number {
  let sizeA = 0
  let sizeB = 0
  let common = 0
  for (const count of a.values()) sizeA += count
  for (const [gram, count] of b) {
    sizeB += count
    common += Math.min(count, a.get(gram) ?? 0)
  }
  if (sizeA + sizeB === 0) return 0
  return (2 * common) / (sizeA + sizeB)
}

/** Similarité entre 0 (rien en commun) et 1 (identique après normalisation). */
export function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  return diceFromGrams(trigrams(na), trigrams(nb))
}

export interface NameCandidate {
  id: number
  name: string
}

export interface NameMatch extends NameCandidate {
  score: number
}

/** Les meilleures correspondances (score décroissant), au-dessus d'un seuil minimal. */
export function bestNameMatches(
  query: string,
  candidates: Iterable<NameCandidate>,
  options: { limit?: number; minScore?: number } = {},
): NameMatch[] {
  const { limit = 5, minScore = 0.3 } = options
  const normalized = normalizeName(query)
  if (normalized.length < 3) return []
  const queryGrams = trigrams(normalized)
  const matches: NameMatch[] = []
  for (const candidate of candidates) {
    const name = normalizeName(candidate.name)
    const score = name === normalized ? 1 : diceFromGrams(queryGrams, trigrams(name))
    if (score >= minScore) matches.push({ ...candidate, score })
  }
  return matches
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, 'fr'))
    .slice(0, limit)
}
