/** États d'une carte, du meilleur au moins bon (échelle courante des marchés européens). */
export const CARD_CONDITIONS = [
  'Mint',
  'Near Mint',
  'Excellent',
  'Good',
  'Light Played',
  'Played',
  'Poor',
] as const

export type CardCondition = (typeof CARD_CONDITIONS)[number]

/** Un groupe d'exemplaires identiques possédés (même carte, impression, langue et état). */
export interface CollectionEntry {
  /** Clé auto-incrémentée par IndexedDB, absente avant l'insertion. */
  id?: number
  cardId: number
  /** Code d'impression, ex. "LOB-EN001" ; vide si inconnu. */
  setCode: string
  rarity: string
  /** Code langue ISO 639-1, ex. "fr", "en". */
  language: string
  condition: CardCondition
  quantity: number
  /** Emplacement physique libre : classeur, boîte… */
  location: string
  note: string
  /** Date ISO 8601 d'ajout. */
  addedAt: string
}
