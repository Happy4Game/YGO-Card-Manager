import type { AppDatabase } from '@/db/database'
import type { CardData } from '@/domain/card'
import { setCodeKey } from '@/domain/setCode'
import type { Rect } from './cardFrame'
import { adaptiveThreshold, grayToRgba, toGrayscale } from './imageProcessing'
import { resolveCandidates } from './lookup'
import type { OcrLine, OcrWord } from './ocrEngine'
import { setCodeCandidates } from './ocrText'

/**
 * Scan de plusieurs cartes à la fois : on lit le texte de l'image ENTIÈRE (mode « texte
 * épars » de Tesseract), on y cherche des codes d'impression, et on garde la position de
 * chacun pour l'entourer sur la vidéo. Plus besoin d'aligner une carte dans un cadre.
 */

/** Code repéré dans l'image, avec sa position en pixels de l'image source (vidéo ou photo). */
export interface CodeDetection {
  candidates: string[]
  box: Rect
}

/** Détection reconnue dans la base : code retenu et carte(s) qui portent ce code. */
export interface ResolvedDetection {
  /** Clé sans région (ex. « LOB-001 ») : une même carte n'apparaît qu'une fois. */
  key: string
  code: string
  cards: CardData[]
  box: Rect
}

const union = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y,
  }
}

const scaled = (box: Rect, scale: number): Rect => ({
  x: box.x / scale,
  y: box.y / scale,
  width: box.width / scale,
  height: box.height / scale,
})

/**
 * Codes trouvés dans les lignes lues. On travaille mot par mot (deux cartes côte à côte
 * donnent souvent une seule ligne de texte), en recollant un mot coupé par l'OCR
 * (« LOB-FR » + « 001 »). `scale` : agrandissement appliqué avant l'OCR, à annuler.
 */
export function codesInLines(lines: readonly OcrLine[], scale = 1): CodeDetection[] {
  const detections: CodeDetection[] = []
  const tryWords = (words: readonly OcrWord[]) => {
    const candidates = setCodeCandidates(words.map((word) => word.text).join(''))
    if (candidates.length === 0) return false
    const [first, ...rest] = words
    if (!first) return false
    const box = rest.reduce((acc, word) => union(acc, word.box), first.box)
    detections.push({ candidates, box: scaled(box, scale) })
    return true
  }
  for (const line of lines) {
    const { words } = line
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i]
      if (!word) continue
      if (tryWords([word])) continue
      const next = words[i + 1]
      if (next && tryWords([word, next])) i += 1
    }
  }
  return detections
}

/** Cherche chaque code dans la base locale ; une seule détection par carte (même clé). */
export async function resolveDetections(
  db: AppDatabase,
  detections: readonly CodeDetection[],
): Promise<ResolvedDetection[]> {
  const resolved: ResolvedDetection[] = []
  for (const detection of detections) {
    const resolution = await resolveCandidates(db, detection.candidates)
    const key = resolution ? setCodeKey(resolution.code) : undefined
    if (!resolution || !key || resolved.some((item) => item.key === key)) continue
    resolved.push({ key, code: resolution.code, cards: resolution.cards, box: detection.box })
  }
  return resolved
}

/** Code suivi d'une image à l'autre (pour l'affichage en direct). */
export interface TrackedCode extends ResolvedDetection {
  /** Nombre d'images où le code a été lu. */
  hits: number
  lastSeen: number
  /** Lu assez de fois pour être fiable (et ajouté à la liste des cartes détectées). */
  confirmed: boolean
}

export interface DetectionTracker {
  /**
   * Enregistre les détections d'une image. Renvoie ce qu'il faut entourer sur la vidéo
   * et les codes qui viennent d'être confirmés.
   */
  update(
    detections: readonly ResolvedDetection[],
    now: number,
  ): { visible: TrackedCode[]; confirmed: TrackedCode[] }
  reset(): void
}

/**
 * Validation par répétition : un code n'est retenu qu'après `required` lectures (une lecture
 * isolée peut être fausse). Un code inconnu de la base en exige une de plus. Un code qui
 * n'a plus été vu depuis `ttlMs` disparaît de l'écran.
 */
export function createDetectionTracker(
  options: { required?: number; ttlMs?: number } = {},
): DetectionTracker {
  const { required = 2, ttlMs = 2500 } = options
  const tracked = new Map<string, TrackedCode>()
  return {
    update(detections, now) {
      const confirmed: TrackedCode[] = []
      for (const detection of detections) {
        const previous = tracked.get(detection.key)
        const hits = (previous?.hits ?? 0) + 1
        const needed = detection.cards.length > 0 ? required : required + 1
        const item: TrackedCode = {
          ...detection,
          hits,
          lastSeen: now,
          confirmed: previous?.confirmed === true || hits >= needed,
        }
        if (item.confirmed && previous?.confirmed !== true) confirmed.push(item)
        tracked.set(detection.key, item)
      }
      for (const [key, item] of tracked) {
        if (now - item.lastSeen > ttlMs) tracked.delete(key)
      }
      const visible = [...tracked.values()].filter((item) => item.lastSeen === now)
      return { visible, confirmed }
    },
    reset() {
      tracked.clear()
    },
  }
}

/** Texte sombre sur fond clair (cas courant) ou texte clair sur fond sombre (cartes Xyz). */
export type InkPolarity = 'dark' | 'light'

/**
 * Image entière prête pour l'OCR : redimensionnée par le navigateur (drawImage, rapide),
 * réduite si elle est très grande, agrandie (jusqu'à `maxScale`) si les codes sont petits,
 * puis passée en noir et blanc par seuil adaptatif. Sans ce seuil, Tesseract ne trouve
 * presque rien dans une scène (fond sombre, cartes de couleur) : il est fait pour des pages.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/CanvasRenderingContext2D/drawImage
 * Doc Tesseract (qualité d'image) : https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
 */
export function captureWhole(
  source: CanvasImageSource,
  size: { width: number; height: number },
  options: { maxSide?: number; maxScale?: number; polarity?: InkPolarity | false } = {},
): { canvas: HTMLCanvasElement; scale: number } {
  const { maxSide = 1920, maxScale = 1, polarity = 'dark' } = options
  const longest = Math.max(size.width, size.height)
  const scale = Math.min(maxScale, maxSide / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(size.width * scale))
  canvas.height = Math.max(1, Math.round(size.height * scale))
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('Canvas 2D indisponible')
  context.imageSmoothingQuality = 'high'
  context.drawImage(source, 0, 0, canvas.width, canvas.height)
  if (polarity) {
    const gray = toGrayscale(context.getImageData(0, 0, canvas.width, canvas.height))
    // Voisinage ≈ 1/85 de l'image (15 px pour 1 280 px) : plus grand qu'un trait de lettre,
    // plus petit qu'un code entier.
    const radius = Math.max(8, Math.round(Math.max(canvas.width, canvas.height) / 85))
    const binary = grayToRgba(adaptiveThreshold(gray, { radius, polarity }))
    context.putImageData(
      new ImageData(new Uint8ClampedArray(binary.data), binary.width, binary.height),
      0,
      0,
    )
  }
  return { canvas, scale }
}
