import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { CARD_CONDITIONS, type CardCondition } from '@/domain/collection'
import { setCodeKey } from '@/domain/setCode'
import { addEntry, changeQuantity } from './collection'

/**
 * Ajout en un geste : un exemplaire avec les derniers réglages utilisés (langue, état,
 * emplacement), sans passer par le formulaire. Le formulaire complet reste disponible.
 */
export interface AddDefaults {
  language: string
  condition: CardCondition
  location: string
}

const DEFAULTS_KEY = 'collection:lastDefaults'
export const INITIAL_DEFAULTS: AddDefaults = {
  language: 'fr',
  condition: 'Near Mint',
  location: '',
}

function isCondition(value: unknown): value is CardCondition {
  return typeof value === 'string' && (CARD_CONDITIONS as readonly string[]).includes(value)
}

/** Derniers réglages mémorisés (localStorage peut être indisponible : on retombe sur les défauts). */
export function readDefaults(): AddDefaults {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(DEFAULTS_KEY) ?? 'null')
    if (typeof raw !== 'object' || raw === null) return INITIAL_DEFAULTS
    const { language, condition, location } = raw as Record<string, unknown>
    return {
      language: typeof language === 'string' && /^[a-z]{2}$/.test(language) ? language : 'fr',
      condition: isCondition(condition) ? condition : 'Near Mint',
      location: typeof location === 'string' ? location.slice(0, 500) : '',
    }
  } catch {
    return INITIAL_DEFAULTS
  }
}

export function rememberDefaults(defaults: AddDefaults): void {
  try {
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(defaults))
  } catch {
    // Préférence non mémorisée : sans gravité.
  }
}

/**
 * Impression à utiliser : celle qui correspond au code lu ou cherché, sinon la seule
 * impression connue. Avec plusieurs impressions et aucun indice, on laisse vide plutôt
 * que de deviner.
 */
export function pickPrint(card: CardData, setCode?: string) {
  const key = setCode ? setCodeKey(setCode) : undefined
  const matched = key ? card.sets.find((set) => setCodeKey(set.code) === key) : undefined
  if (matched) return { code: setCode?.toUpperCase() ?? matched.code, rarity: matched.rarity }
  if (setCode) return { code: setCode.toUpperCase(), rarity: '' }
  const only = card.sets.length === 1 ? card.sets[0] : undefined
  return only ? { code: only.code, rarity: only.rarity } : { code: '', rarity: '' }
}

export async function quickAdd(
  db: AppDatabase,
  card: CardData,
  setCode?: string,
  defaults: AddDefaults = readDefaults(),
): Promise<number> {
  const print = pickPrint(card, setCode)
  return addEntry(db, {
    cardId: card.id,
    setCode: print.code,
    rarity: print.rarity,
    language: defaults.language,
    condition: defaults.condition,
    quantity: 1,
    location: defaults.location,
    note: '',
  })
}

/** Annule un ajout rapide : retire l'exemplaire ajouté (l'entrée disparaît à 0). */
export async function undoQuickAdd(db: AppDatabase, entryId: number): Promise<void> {
  await changeQuantity(db, entryId, -1)
}
