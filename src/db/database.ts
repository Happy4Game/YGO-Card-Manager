import Dexie, { type EntityTable } from 'dexie'
import type { CardData } from '@/domain/card'
import type { CollectionEntry } from '@/domain/collection'

/** Paires clé/valeur techniques (ex. version de la base YGOPRODeck synchronisée). */
export interface MetaEntry {
  key: string
  value: string
}

/**
 * Base locale de l'application (IndexedDB via Dexie).
 * Doc Dexie : https://dexie.org/docs/Tutorial/Vue
 *
 * - `cards` : cache des cartes téléchargées depuis YGOPRODeck (reconstructible à tout moment).
 * - `collection` : les exemplaires possédés par l'utilisateur (donnée précieuse, à exporter).
 * - `meta` : informations techniques.
 */
export class AppDatabase extends Dexie {
  cards!: EntityTable<CardData, 'id'>
  collection!: EntityTable<CollectionEntry, 'id'>
  meta!: EntityTable<MetaEntry, 'key'>

  constructor(name = 'card-manager') {
    super(name)
    this.version(1).stores({
      cards: 'id, name, type, archetype',
      collection: '++id, cardId, setCode, location',
      meta: 'key',
    })
    // v2 : index multiEntry (*) sur les clés de codes d'impression, pour le scan et la recherche.
    // Le cache des cartes est reconstructible : on le vide et on force une resynchronisation.
    // Doc : https://dexie.org/docs/Tutorial/Design#database-versioning
    this.version(2)
      .stores({ cards: 'id, name, type, archetype, *setKeys' })
      .upgrade(async (tx) => {
        await tx.table('cards').clear()
        await tx.table('meta').where('key').startsWith('dbVersion:').delete()
      })
  }
}

export const db = new AppDatabase()
