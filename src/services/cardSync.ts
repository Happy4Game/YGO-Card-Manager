import { ApiFormatError, type CardLanguage } from '@/api/ygoprodeck'
import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'

/** Fonctions réseau nécessaires à la synchronisation (injectées pour les tests). */
export interface CardSyncApi {
  fetchDbVersion: () => Promise<string>
  fetchAllCards: (language: CardLanguage) => Promise<CardData[]>
}

export interface CardSyncResult {
  status: 'up-to-date' | 'updated'
  /** Nombre de cartes présentes localement après la synchronisation. */
  count: number
}

const VERSION_KEY_PREFIX = 'dbVersion:'

export function versionKey(language: CardLanguage): string {
  return `${VERSION_KEY_PREFIX}${language}`
}

/**
 * Met à jour le cache local des cartes seulement si la base distante a changé
 * (ou si le cache est vide), conformément au guide YGOPRODeck : « télécharger une seule fois ».
 */
export async function syncCards(
  db: AppDatabase,
  api: CardSyncApi,
  language: CardLanguage,
): Promise<CardSyncResult> {
  const remoteVersion = await api.fetchDbVersion()
  const [localVersion, localCount] = await Promise.all([
    db.meta.get(versionKey(language)),
    db.cards.count(),
  ])

  if (localVersion?.value === remoteVersion && localCount > 0) {
    return { status: 'up-to-date', count: localCount }
  }

  // Le téléchargement se fait AVANT la transaction : une transaction Dexie se termine
  // dès qu'on attend autre chose qu'une opération Dexie (ex. un fetch).
  // Doc : https://dexie.org/docs/Dexie/Dexie.transaction()
  const cards = await api.fetchAllCards(language)
  if (cards.length === 0) {
    // Garde-fou : ne jamais vider un cache valide à cause d'une réponse vide.
    throw new ApiFormatError('Aucune carte reçue : le cache local est conservé.')
  }

  await db.transaction('rw', db.cards, db.meta, async () => {
    await db.cards.clear()
    await db.cards.bulkPut(cards)
    // La table `cards` ne contient qu'une langue à la fois : on efface les versions
    // des autres langues pour qu'elles soient retéléchargées si on change de langue.
    await db.meta.where('key').startsWith(VERSION_KEY_PREFIX).delete()
    await db.meta.put({ key: versionKey(language), value: remoteVersion })
  })

  return { status: 'updated', count: cards.length }
}
