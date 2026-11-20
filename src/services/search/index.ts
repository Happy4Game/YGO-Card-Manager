/**
 * Point d'entrée de la recherche : un moteur partagé par toute la page (un seul cache en mémoire).
 */
import { db } from '@/db/database'
import { SearchEngine } from './searchEngine'

export const searchEngine = new SearchEngine(db)

export * from './queryParser'
export * from './searchEngine'
export * from './advancedQuery'
