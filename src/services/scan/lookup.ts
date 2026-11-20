import type { AppDatabase } from '@/db/database'
import type { CardData, CardSet } from '@/domain/card'
import { setCodeKey } from '@/domain/setCode'
import type { NameCandidate } from './nameMatch'
import { candidateKeys } from './ocrText'

/** Cartes dont un tirage porte ce code (toutes langues : on compare la clé sans région). */
export async function findCardsBySetCode(db: AppDatabase, code: string): Promise<CardData[]> {
  const key = setCodeKey(code)
  if (!key) return []
  // Index multiEntry « *setKeys » : une carte est trouvée si l'une de ses clés vaut `key`.
  // Doc Dexie : https://dexie.org/docs/MultiEntry-Index
  return db.cards.where('setKeys').equals(key).toArray()
}

export interface CodeResolution {
  /** Code retenu (tel que lu, région comprise). */
  code: string
  cards: CardData[]
}

/**
 * Premier candidat OCR qui correspond à au moins une carte connue. Si aucun ne correspond,
 * renvoie le premier candidat avec une liste vide (code lu, mais carte absente de la base).
 */
export async function resolveCandidates(
  db: AppDatabase,
  candidates: readonly string[],
): Promise<CodeResolution | undefined> {
  const keys = candidateKeys(candidates)
  if (keys.length === 0) return undefined
  const found = await db.cards.where('setKeys').anyOf(keys).toArray()
  for (const code of candidates) {
    const key = setCodeKey(code)
    const cards = found.filter((card) => key !== undefined && card.setKeys.includes(key))
    if (cards.length > 0) return { code, cards }
  }
  const first = candidates[0]
  return first === undefined ? undefined : { code: first, cards: [] }
}

/** Tirage de la carte correspondant au code lu (même clé) ; on préfère la même région. */
export function matchingSet(card: CardData, code: string): CardSet | undefined {
  const key = setCodeKey(code)
  if (!key) return undefined
  const sameKey = card.sets.filter((set) => setCodeKey(set.code) === key)
  return sameKey.find((set) => set.code === code.toUpperCase()) ?? sameKey[0]
}

/** Codes d'impression français d'une carte en premier (application en français). */
export function preferredSetCodes(card: CardData): string[] {
  const codes = [...new Set(card.sets.map((set) => set.code))]
  const isFrench = (code: string) => /-FR?\d/.test(code)
  return [...codes.filter(isFrench), ...codes.filter((code) => !isFrench(code))]
}

/**
 * Identifiants et noms de toutes les cartes, sans charger les textes complets : on parcourt
 * deux fois l'index « name » (clés puis clés primaires, dans le même ordre).
 * Doc Dexie : https://dexie.org/docs/Collection/Collection.primaryKeys()
 */
export async function loadNameIndex(db: AppDatabase): Promise<NameCandidate[]> {
  const [names, ids] = await db.transaction('r', db.cards, () =>
    Promise.all([db.cards.orderBy('name').keys(), db.cards.orderBy('name').primaryKeys()]),
  )
  const index: NameCandidate[] = []
  names.forEach((name, i) => {
    const id = ids[i]
    if (typeof name === 'string' && typeof id === 'number') index.push({ id, name })
  })
  return index
}

export function countCards(db: AppDatabase): Promise<number> {
  return db.cards.count()
}
