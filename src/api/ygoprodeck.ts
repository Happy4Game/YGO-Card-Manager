/**
 * Client minimal de l'API publique YGOPRODeck (v7), basé sur `fetch`.
 *
 * Règles du guide officiel (https://ygoprodeck.com/api-guide/) :
 * - 20 requêtes par seconde au maximum ;
 * - stocker les données localement et ne les télécharger qu'une seule fois.
 * Une synchronisation fait donc au plus 2 requêtes : la version de la base, puis
 * (seulement si elle a changé) la liste complète des cartes, gardée ensuite dans IndexedDB.
 *
 * Les réponses sont validées à l'exécution : TypeScript ne vérifie rien sur des données
 * venant du réseau, d'où le type `unknown` plutôt qu'un cast `as`.
 */
import type { CardData, CardSet } from '@/domain/card'
import type { CardPrices } from '@/domain/price'
import { setCodeKey } from '@/domain/setCode'

export const API_BASE_URL = 'https://db.ygoprodeck.com/api/v7'

/** Langues proposées pour les textes des cartes. L'anglais est la langue par défaut de l'API. */
export type CardLanguage = 'fr' | 'en'

/** Permet d'injecter un faux `fetch` dans les tests. */
export type FetchFn = (input: string, init?: RequestInit) => Promise<Response>

/** Erreur HTTP (statut hors 2xx) renvoyée par l'API. */
export class ApiHttpError extends Error {
  readonly status: number

  constructor(status: number) {
    super(`YGOPRODeck a répondu avec le statut HTTP ${status}`)
    this.name = 'ApiHttpError'
    this.status = status
  }
}

/** La réponse ne correspond pas au format attendu. */
export class ApiFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ApiFormatError'
  }
}

/** Une entrée de carte invalide (champ obligatoire manquant ou de mauvais type). */
export class InvalidCardError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidCardError'
  }
}

// --- Petites fonctions de validation (« type guards ») ---
// Doc TypeScript : https://www.typescriptlang.org/docs/handbook/2/narrowing.html

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function toCardSet(raw: unknown): CardSet | undefined {
  if (!isRecord(raw) || typeof raw.set_code !== 'string' || typeof raw.set_name !== 'string') {
    return undefined
  }
  return {
    code: raw.set_code,
    name: raw.set_name,
    rarity: typeof raw.set_rarity === 'string' ? raw.set_rarity : '',
  }
}

/**
 * Convertit un objet carte de l'API en `CardData`.
 * Lève `InvalidCardError` si `id`, `name` ou `type` sont absents ou invalides ;
 * les champs facultatifs de mauvais type sont simplement ignorés.
 */
export function toCardData(raw: unknown): CardData {
  if (!isRecord(raw)) throw new InvalidCardError("L'entrée n'est pas un objet")
  const { id, name, type } = raw
  if (typeof id !== 'number' || !Number.isInteger(id)) {
    throw new InvalidCardError('Identifiant manquant ou invalide')
  }
  if (typeof name !== 'string' || name === '') {
    throw new InvalidCardError(`Nom manquant pour la carte ${id}`)
  }
  if (typeof type !== 'string' || type === '') {
    throw new InvalidCardError(`Type manquant pour la carte ${id}`)
  }

  const sets = Array.isArray(raw.card_sets)
    ? raw.card_sets.map(toCardSet).filter((set): set is CardSet => set !== undefined)
    : []
  const card: CardData = {
    id,
    name,
    type,
    frameType: typeof raw.frameType === 'string' ? raw.frameType : '',
    desc: typeof raw.desc === 'string' ? raw.desc : '',
    race: typeof raw.race === 'string' ? raw.race : '',
    sets,
    setKeys: [
      ...new Set(sets.map((set) => setCodeKey(set.code)).filter((key) => key !== undefined)),
    ],
  }

  // On n'ajoute les champs facultatifs que s'ils existent, pour garder des objets compacts.
  const typeLabel = optionalString(raw.humanReadableCardType)
  if (typeLabel !== undefined) card.typeLabel = typeLabel
  const attribute = optionalString(raw.attribute)
  if (attribute !== undefined) card.attribute = attribute
  const archetype = optionalString(raw.archetype)
  if (archetype !== undefined) card.archetype = archetype
  const atk = optionalNumber(raw.atk)
  if (atk !== undefined) card.atk = atk
  const def = optionalNumber(raw.def)
  if (def !== undefined) card.def = def
  const level = optionalNumber(raw.level)
  if (level !== undefined) card.level = level
  const scale = optionalNumber(raw.scale)
  if (scale !== undefined) card.scale = scale
  const linkval = optionalNumber(raw.linkval)
  if (linkval !== undefined) card.linkval = linkval
  if (Array.isArray(raw.linkmarkers)) {
    const markers = raw.linkmarkers.filter((m): m is string => typeof m === 'string')
    if (markers.length > 0) card.linkmarkers = markers
  }
  return card
}

/** Convertit une liste brute en ignorant les entrées invalides. */
export function toCardList(rawList: readonly unknown[]): CardData[] {
  const cards: CardData[] = []
  for (const raw of rawList) {
    try {
      cards.push(toCardData(raw))
    } catch (error) {
      if (!(error instanceof InvalidCardError)) throw error
      // Entrée ignorée : une carte mal formée ne doit pas bloquer toute la synchronisation.
    }
  }
  return cards
}

async function getJson(url: string, fetchFn: FetchFn): Promise<unknown> {
  const response = await fetchFn(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw new ApiHttpError(response.status)
  // `response.json()` renvoie `Promise<any>` : on le range aussitôt dans un `unknown`.
  const body: unknown = await response.json()
  return body
}

/**
 * Version actuelle de la base YGOPRODeck (`checkDBVer.php`).
 * Réponse attendue : `[{ "database_version": "x", "last_update": "..." }]`.
 */
export async function fetchDbVersion(fetchFn: FetchFn = fetch): Promise<string> {
  const body = await getJson(`${API_BASE_URL}/checkDBVer.php`, fetchFn)
  const first: unknown = Array.isArray(body) ? body[0] : body
  if (isRecord(first)) {
    const version = first.database_version
    if (typeof version === 'string' && version !== '') return version
    if (typeof version === 'number') return String(version)
  }
  throw new ApiFormatError('Version de la base introuvable dans la réponse')
}

/**
 * Toutes les cartes dans la langue demandée (`cardinfo.php` sans filtre).
 * Sans paramètre `language`, l'API renvoie l'anglais.
 */
export async function fetchAllCards(
  language: CardLanguage,
  fetchFn: FetchFn = fetch,
): Promise<CardData[]> {
  const url =
    language === 'en'
      ? `${API_BASE_URL}/cardinfo.php`
      : `${API_BASE_URL}/cardinfo.php?language=${encodeURIComponent(language)}`
  const body = await getJson(url, fetchFn)
  if (!isRecord(body) || !Array.isArray(body.data)) {
    throw new ApiFormatError('Liste de cartes introuvable dans la réponse')
  }
  return toCardList(body.data)
}

/** Nombre maximal d'identifiants par requête (garde l'URL courte). */
const IDS_PER_REQUEST = 50

function priceValue(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

/** Extrait le prix Cardmarket d'un objet carte de l'API (`card_prices[0].cardmarket_price`). */
export function toCardPrices(raw: unknown): CardPrices | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'number') return undefined
  const first: unknown = Array.isArray(raw.card_prices) ? raw.card_prices[0] : undefined
  return {
    cardId: raw.id,
    cardmarket: isRecord(first) ? priceValue(first.cardmarket_price) : null,
  }
}

/**
 * Prix actuels de quelques cartes seulement : `cardinfo.php?id=1,2,3` accepte plusieurs
 * identifiants séparés par des virgules (guide officiel de l'API). Une petite requête par
 * paquet de 50 cartes, au lieu de retélécharger toute la base (~18 Mo).
 */
export async function fetchCardPrices(
  ids: readonly number[],
  fetchFn: FetchFn = fetch,
): Promise<CardPrices[]> {
  const prices: CardPrices[] = []
  for (let start = 0; start < ids.length; start += IDS_PER_REQUEST) {
    const chunk = ids.slice(start, start + IDS_PER_REQUEST)
    const body = await getJson(`${API_BASE_URL}/cardinfo.php?id=${chunk.join(',')}`, fetchFn)
    const data: unknown = isRecord(body) ? body.data : undefined
    if (!Array.isArray(data)) throw new ApiFormatError('Réponse inattendue pour les prix')
    for (const raw of data) {
      const price = toCardPrices(raw)
      if (price) prices.push(price)
    }
  }
  return prices
}
