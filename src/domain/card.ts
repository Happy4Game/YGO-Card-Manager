/**
 * Carte telle que stockée localement (IndexedDB).
 *
 * Objet simple et sérialisable (pas de classe) : IndexedDB stocke des données via
 * l'algorithme de clonage structuré, qui ne conserve pas les prototypes.
 * Référence : https://developer.mozilla.org/fr/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
 */
export interface CardSet {
  /** Code d'impression, ex. "LOB-EN001". */
  code: string
  name: string
  rarity: string
}

export interface CardData {
  /** Passcode à 8 chiffres, identifiant stable de la carte. */
  id: number
  name: string
  /** Type complet renvoyé par l'API, ex. "Effect Monster", "Spell Card". */
  type: string
  frameType: string
  desc: string
  /** Type de monstre (Warrior…) ou sous-type de Magie/Piège (Normal, Quick-Play…). */
  race: string
  attribute?: string
  atk?: number
  def?: number
  level?: number
  scale?: number
  linkval?: number
  linkmarkers?: string[]
  archetype?: string
  sets: CardSet[]
}
