/**
 * Géométrie du viseur : cadre au format d'une carte et zones où se trouvent le code
 * d'impression et le nom. Fonctions pures, testées sans caméra.
 */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Format d'une carte : 59 × 86 mm (largeur / hauteur). */
export const CARD_RATIO = 59 / 86

/**
 * Zones relatives à la carte (fractions de 0 à 1 de sa largeur et de sa hauteur).
 * Le code d'impression est à droite, juste sous l'illustration ; le nom est dans le bandeau
 * du haut (on évite l'icône d'attribut à droite). Les marges tolèrent un cadrage approximatif.
 */
export const CARD_ZONES = {
  code: { x: 0.52, y: 0.69, width: 0.45, height: 0.085 },
  name: { x: 0.05, y: 0.035, width: 0.75, height: 0.09 },
  /** Bas de carte : code des monstres Pendule (en bas à gauche), lu en mode « texte épars ». */
  lower: { x: 0.03, y: 0.68, width: 0.94, height: 0.3 },
} as const satisfies Record<string, Rect>

export type CardZone = keyof typeof CARD_ZONES

/**
 * Plus grand cadre au format carte centré dans une boîte, en gardant une marge
 * (`fill` = part maximale occupée en largeur et en hauteur).
 */
export function cardFrameInBox(boxWidth: number, boxHeight: number, fill = 0.84): Rect {
  const maxWidth = boxWidth * fill
  const maxHeight = boxHeight * fill
  let width = maxWidth
  let height = width / CARD_RATIO
  if (height > maxHeight) {
    height = maxHeight
    width = height * CARD_RATIO
  }
  return { x: (boxWidth - width) / 2, y: (boxHeight - height) / 2, width, height }
}

/** Zone d'une carte, en pixels, à partir du cadre de la carte. */
export function zoneInFrame(frame: Rect, zone: Rect): Rect {
  return {
    x: frame.x + zone.x * frame.width,
    y: frame.y + zone.y * frame.height,
    width: zone.width * frame.width,
    height: zone.height * frame.height,
  }
}

/**
 * Convertit un rectangle affiché (pixels CSS du conteneur) en pixels de la vidéo, quand la
 * vidéo remplit le conteneur avec `object-fit: cover` (agrandie puis rognée au centre).
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/CSS/object-fit
 */
export function containerRectToMedia(
  rect: Rect,
  container: { width: number; height: number },
  media: { width: number; height: number },
): Rect {
  const scale = Math.max(container.width / media.width, container.height / media.height)
  const offsetX = (media.width * scale - container.width) / 2
  const offsetY = (media.height * scale - container.height) / 2
  return {
    x: (rect.x + offsetX) / scale,
    y: (rect.y + offsetY) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }
}

/** Arrondit et borne un rectangle à l'intérieur d'une image (jamais vide). */
export function clampRect(rect: Rect, width: number, height: number): Rect {
  const x = Math.min(Math.max(0, Math.round(rect.x)), Math.max(0, width - 1))
  const y = Math.min(Math.max(0, Math.round(rect.y)), Math.max(0, height - 1))
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(rect.width), width - x)),
    height: Math.max(1, Math.min(Math.round(rect.height), height - y)),
  }
}
