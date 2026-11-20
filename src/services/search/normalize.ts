/**
 * Normalisation des textes pour la recherche.
 *
 * `normalize('NFD')` sépare chaque lettre de son accent (« é » → « e » + accent combinant),
 * que l'on retire ensuite avec une plage Unicode.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
 */
const COMBINING_MARKS = /[̀-ͯ]/g
/** Tout ce qui n'est ni lettre ni chiffre (tirets, apostrophes, ponctuation…). */
const NON_WORD = /[^\p{L}\p{N}]+/gu

/** Minuscules et sans accents, ponctuation conservée. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase()
}

/**
 * Forme « mots » d'un texte : minuscules, sans accents, ponctuation remplacée par des espaces.
 * « Blue-Eyes » et « blue eyes » donnent la même chose, « l'Épée » donne « l epee ».
 */
export function normalizeWords(text: string): string {
  return normalizeText(text).replace(NON_WORD, ' ').trim()
}

/** Découpe un texte en mots normalisés (sans mot vide). */
export function splitWords(text: string): string[] {
  const words = normalizeWords(text)
  return words === '' ? [] : words.split(' ')
}

/** Clé simple pour comparer des noms de champs ou de valeurs (« Ténèbres » → « tenebres »). */
export function keyOf(text: string): string {
  return normalizeWords(text).replace(/ /g, '-')
}
