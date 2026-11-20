import type { AppDatabase } from '@/db/database'
import { CARD_CONDITIONS, type CollectionEntry } from '@/domain/collection'
import { addEntry, cardNames, fallbackCardName, isCardCondition } from '@/services/collection'

/**
 * Export / import de la collection.
 *
 * La collection n'existe que dans ce navigateur : l'export est la seule sauvegarde possible.
 * Le JSON permet de tout réimporter ; le CSV sert à ouvrir la collection dans un tableur.
 */

export const EXPORT_APP = 'card-manager'
export const EXPORT_VERSION = 1

/** Entrée exportée : sans l'id auto-incrémenté, propre à chaque base. */
export type ExportedEntry = Omit<CollectionEntry, 'id'>

export interface CollectionExport {
  app: typeof EXPORT_APP
  version: typeof EXPORT_VERSION
  /** Date ISO 8601 de l'export. */
  exportedAt: string
  entries: ExportedEntry[]
}

export type ImportMode = 'merge' | 'replace'

export type ParseResult = { ok: true; entries: ExportedEntry[] } | { ok: false; errors: string[] }

export type ImportResult =
  | { ok: true; count: number; mode: ImportMode }
  | { ok: false; errors: string[] }

/** Au-delà, on résume les erreurs pour ne pas noyer l'utilisateur. */
const MAX_REPORTED_ERRORS = 20

/** Copie uniquement les champs connus, dans un ordre stable (l'id est volontairement omis). */
function toExported(entry: CollectionEntry): ExportedEntry {
  return {
    cardId: entry.cardId,
    setCode: entry.setCode,
    rarity: entry.rarity,
    language: entry.language,
    condition: entry.condition,
    quantity: entry.quantity,
    location: entry.location,
    note: entry.note,
    addedAt: entry.addedAt,
  }
}

async function sortedEntries(db: AppDatabase): Promise<CollectionEntry[]> {
  // Ordre d'ajout : un export identique produit un fichier identique.
  return db.collection.orderBy('id').toArray()
}

export async function buildExport(db: AppDatabase, now = new Date()): Promise<CollectionExport> {
  const entries = await sortedEntries(db)
  return {
    app: EXPORT_APP,
    version: EXPORT_VERSION,
    exportedAt: now.toISOString(),
    entries: entries.map(toExported),
  }
}

export async function exportToJson(db: AppDatabase, now = new Date()): Promise<string> {
  return JSON.stringify(await buildExport(db, now), null, 2)
}

/**
 * Échappe un champ CSV selon la RFC 4180 (https://www.rfc-editor.org/rfc/rfc4180#section-2) :
 * un champ contenant une virgule, un guillemet ou un saut de ligne est entouré de guillemets,
 * et chaque guillemet interne est doublé.
 */
export function escapeCsvField(value: string | number): string {
  const text = String(value)
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Neutralise les textes qui commencent par = + - @ (tabulation, retour chariot) : un tableur
 * les interpréterait comme des formules (« injection CSV »).
 * Référence : https://owasp.org/www-community/attacks/CSV_Injection
 */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
}

const CSV_COLUMNS = [
  'cardId',
  'cardName',
  'setCode',
  'rarity',
  'language',
  'condition',
  'quantity',
  'location',
  'note',
  'addedAt',
] as const

/** Export CSV avec ligne d'en-tête, fins de ligne CRLF (RFC 4180) et nom de carte en clair. */
export async function exportToCsv(db: AppDatabase): Promise<string> {
  const entries = await sortedEntries(db)
  const names = await cardNames(
    db,
    entries.map((entry) => entry.cardId),
  )
  const text = (value: string) => escapeCsvField(neutralizeFormula(value))

  const rows = entries.map((entry) =>
    [
      escapeCsvField(entry.cardId),
      text(names.get(entry.cardId) ?? fallbackCardName(entry.cardId)),
      text(entry.setCode),
      text(entry.rarity),
      text(entry.language),
      text(entry.condition),
      escapeCsvField(entry.quantity),
      text(entry.location),
      text(entry.note),
      text(entry.addedAt),
    ].join(','),
  )
  return [CSV_COLUMNS.join(','), ...rows].join('\r\n') + '\r\n'
}

// --- Validation à l'exécution -------------------------------------------------------------
// TypeScript ne vérifie rien à l'exécution : un fichier importé peut contenir n'importe quoi.
// On inspecte donc chaque valeur (type `unknown`) avant de lui faire confiance, sans `as`.

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const MAX_TEXT_LENGTH = 500

/** Renvoie la valeur si c'est un entier ≥ 1, sinon `undefined`. */
function positiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : undefined
}

function validateEntry(raw: unknown, row: number, errors: string[]): ExportedEntry | null {
  if (!isRecord(raw)) {
    errors.push(`Ligne ${row} : l'entrée doit être un objet.`)
    return null
  }
  const before = errors.length
  const fail = (field: string, expected: string) =>
    errors.push(`Ligne ${row} : champ « ${field} » invalide (${expected}).`)

  const text = (field: string): string => {
    const value = raw[field]
    if (typeof value !== 'string' || value.length > MAX_TEXT_LENGTH) {
      fail(field, `texte de ${MAX_TEXT_LENGTH} caractères au plus attendu`)
      return ''
    }
    return value
  }

  const cardId = positiveInteger(raw.cardId)
  if (cardId === undefined) fail('cardId', 'entier positif attendu')

  const quantity = positiveInteger(raw.quantity)
  if (quantity === undefined) fail('quantity', 'entier supérieur ou égal à 1 attendu')

  const condition = isCardCondition(raw.condition) ? raw.condition : undefined
  if (condition === undefined) {
    fail('condition', `une valeur parmi ${CARD_CONDITIONS.join(', ')} attendue`)
  }

  const language =
    typeof raw.language === 'string' && /^[a-z]{2}$/.test(raw.language) ? raw.language : undefined
  if (language === undefined) fail('language', 'code langue à deux lettres attendu, ex. « fr »')

  const addedAt =
    typeof raw.addedAt === 'string' && !Number.isNaN(Date.parse(raw.addedAt))
      ? raw.addedAt
      : undefined
  if (addedAt === undefined) fail('addedAt', 'date ISO 8601 attendue')

  const setCode = text('setCode')
  const rarity = text('rarity')
  const location = text('location')
  const note = text('note')

  if (
    errors.length > before ||
    cardId === undefined ||
    quantity === undefined ||
    condition === undefined ||
    language === undefined ||
    addedAt === undefined
  ) {
    return null
  }
  return { cardId, setCode, rarity, language, condition, quantity, location, note, addedAt }
}

/** Analyse et valide un fichier d'export JSON. Tout ou rien : une seule ligne invalide bloque. */
export function parseImport(json: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    return { ok: false, errors: ["Le fichier n'est pas un JSON valide."] }
  }
  if (!isRecord(data) || data.app !== EXPORT_APP) {
    return { ok: false, errors: ["Ce fichier n'est pas un export de cette application."] }
  }
  if (data.version !== EXPORT_VERSION) {
    return {
      ok: false,
      errors: [`Version de fichier non prise en charge : ${JSON.stringify(data.version) ?? '?'}.`],
    }
  }
  if (!Array.isArray(data.entries)) {
    return { ok: false, errors: ['Le champ « entries » doit être une liste.'] }
  }

  const errors: string[] = []
  const entries: ExportedEntry[] = []
  data.entries.forEach((raw: unknown, index: number) => {
    const entry = validateEntry(raw, index + 1, errors)
    if (entry) entries.push(entry)
  })

  if (errors.length > 0) {
    const shown = errors.slice(0, MAX_REPORTED_ERRORS)
    if (errors.length > MAX_REPORTED_ERRORS) {
      shown.push(`… et ${errors.length - MAX_REPORTED_ERRORS} autre(s) erreur(s).`)
    }
    return { ok: false, errors: shown }
  }
  return { ok: true, entries }
}

/**
 * Enregistre des entrées déjà validées.
 * - `merge` : ajoute chaque entrée (les doublons augmentent la quantité existante).
 * - `replace` : vide la collection puis insère tout, dans une seule transaction : en cas
 *   d'erreur, rien n'est effacé (doc : https://dexie.org/docs/Dexie/Dexie.transaction()).
 */
export async function importEntries(
  db: AppDatabase,
  entries: readonly ExportedEntry[],
  mode: ImportMode,
): Promise<number> {
  await db.transaction('rw', db.collection, async () => {
    if (mode === 'replace') {
      await db.collection.clear()
      await db.collection.bulkAdd(entries.map((entry) => ({ ...entry })))
    } else {
      for (const entry of entries) {
        await addEntry(db, entry)
      }
    }
  })
  return entries.length
}

/** Valide puis importe le contenu d'un fichier JSON. */
export async function importFromJson(
  db: AppDatabase,
  json: string,
  mode: ImportMode,
): Promise<ImportResult> {
  const parsed = parseImport(json)
  if (!parsed.ok) return parsed
  const count = await importEntries(db, parsed.entries, mode)
  return { ok: true, count, mode }
}

/**
 * Fait télécharger un fichier généré dans le navigateur, sans serveur.
 * Doc : https://developer.mozilla.org/fr/docs/Web/API/URL/createObjectURL_static
 */
export function downloadFile(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.hidden = true
  document.body.append(link)
  link.click()
  link.remove()
  // Libère la mémoire du Blob ; le délai laisse au navigateur le temps de démarrer le téléchargement.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

/** Nom de fichier daté, ex. "collection-2026-11-20.json". */
export function exportFilename(extension: 'json' | 'csv', now = new Date()): string {
  return `collection-${now.toISOString().slice(0, 10)}.${extension}`
}
