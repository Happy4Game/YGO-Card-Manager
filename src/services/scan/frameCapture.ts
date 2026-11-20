import { clampRect, type Rect } from './cardFrame'
import { preprocessForOcr, scaleForHeight, type PreprocessOptions } from './imageProcessing'

/**
 * Découpe une zone d'une image (vidéo, photo) dans un canvas, puis la prépare pour l'OCR.
 * Doc MDN (drawImage avec rognage) :
 * https://developer.mozilla.org/fr/docs/Web/API/CanvasRenderingContext2D/drawImage
 */
export interface CaptureOptions extends Omit<PreprocessOptions, 'scale'> {
  /** Hauteur visée après agrandissement (px) : Tesseract aime des lettres de 20 à 40 px. */
  targetHeight?: number
  /** Largeur maximale de la zone source avant agrandissement (limite le temps d'OCR). */
  maxSourceWidth?: number
}

export function captureZone(
  source: CanvasImageSource,
  sourceSize: { width: number; height: number },
  zone: Rect,
  options: CaptureOptions = {},
): HTMLCanvasElement {
  const { targetHeight = 96, maxSourceWidth = 1600, threshold } = options
  const rect = clampRect(zone, sourceSize.width, sourceSize.height)
  // Une zone très large (photo entière) est d'abord réduite, pour garder un OCR rapide.
  const shrink = Math.min(1, maxSourceWidth / rect.width)
  const width = Math.max(1, Math.round(rect.width * shrink))
  const height = Math.max(1, Math.round(rect.height * shrink))

  const crop = document.createElement('canvas')
  crop.width = width
  crop.height = height
  // willReadFrequently : on relit les pixels à chaque image (optimisation du navigateur).
  const cropContext = crop.getContext('2d', { willReadFrequently: true })
  if (!cropContext) throw new Error('Canvas 2D indisponible')
  cropContext.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, width, height)

  const processed = preprocessForOcr(cropContext.getImageData(0, 0, width, height), {
    scale: scaleForHeight(height, targetHeight),
    threshold,
  })
  const out = document.createElement('canvas')
  out.width = processed.width
  out.height = processed.height
  const outContext = out.getContext('2d')
  if (!outContext) throw new Error('Canvas 2D indisponible')
  outContext.putImageData(
    new ImageData(new Uint8ClampedArray(processed.data), processed.width, processed.height),
    0,
    0,
  )
  return out
}

/** Charge une photo importée (fichier) dans un bitmap, en respectant l'orientation EXIF. */
export async function loadPhoto(file: Blob): Promise<ImageBitmap> {
  // Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Window/createImageBitmap
  return createImageBitmap(file, { imageOrientation: 'from-image' })
}
