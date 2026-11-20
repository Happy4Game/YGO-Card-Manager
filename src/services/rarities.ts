import type { AppDatabase } from '@/db/database'

/**
 * Toutes les raretés déjà connues : celles des impressions des cartes téléchargées (champ
 * `set_rarity` de l'API) et celles déjà saisies dans la collection. L'API n'a pas de liste
 * officielle des raretés : on la déduit des données, donc elle suit les nouvelles raretés.
 */
export async function listRarities(db: AppDatabase): Promise<string[]> {
  const rarities = new Set<string>()
  await db.cards.each((card) => {
    for (const set of card.sets) if (set.rarity) rarities.add(set.rarity)
  })
  await db.collection.each((entry) => {
    const rarity = entry.rarity.trim()
    if (rarity) rarities.add(rarity)
  })
  return [...rarities].sort((a, b) => a.localeCompare(b, 'fr'))
}
