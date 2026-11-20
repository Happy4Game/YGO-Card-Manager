import type { CardData } from '@/domain/card'

/** Contenu de la feuille de résultat du scan. */
export type SheetContent =
  /** Code lu ou saisi : 0 carte (introuvable), 1 (détail) ou plusieurs (choix). */
  | { kind: 'code'; code: string; cards: CardData[] }
  /** Nom lu : cartes aux noms les plus proches (choix). */
  | { kind: 'names'; query: string; cards: CardData[] }

/** Carte détectée par le scan, en attente d'ajout (liste « Cartes détectées »). */
export interface DetectedCard {
  /** Clé du code sans région (ex. « LOB-001 ») : une ligne par code. */
  key: string
  code: string
  /** Cartes qui portent ce code (souvent une seule ; vide si le code est inconnu). */
  cards: CardData[]
  /** Carte choisie parmi `cards`. */
  cardId: number | undefined
  rarity: string
  /** Cochée : sera ajoutée par « Ajouter la sélection ». */
  selected: boolean
}
