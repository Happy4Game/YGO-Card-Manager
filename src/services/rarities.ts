import type { AppDatabase } from '@/db/database'

/**
 * Toutes les raretés présentes dans les cartes téléchargées (champ `set_rarity` de chaque
 * impression). L'API n'a pas de liste officielle des raretés : on la déduit des données,
 * donc elle suit automatiquement les nouvelles raretés.
 */
export async function listRarities(db: AppDatabase): Promise<string[]> {
  const rarities = new Set<string>()
  await db.cards.each((card) => {
    for (const set of card.sets) if (set.rarity) rarities.add(set.rarity)
  })
  return [...rarities].sort((a, b) => a.localeCompare(b, 'fr'))
}
