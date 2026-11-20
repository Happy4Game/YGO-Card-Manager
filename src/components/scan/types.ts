import type { CardData } from '@/domain/card'

/** Contenu de la feuille de résultat du scan. */
export type SheetContent =
  /** Code lu ou saisi : 0 carte (introuvable), 1 (détail) ou plusieurs (choix). */
  | { kind: 'code'; code: string; cards: CardData[] }
  /** Nom lu : cartes aux noms les plus proches (choix). */
  | { kind: 'names'; query: string; cards: CardData[] }
