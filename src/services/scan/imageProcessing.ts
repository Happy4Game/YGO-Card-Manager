/**
 * Prétraitement d'image avant l'OCR, en fonctions pures (testables sans navigateur).
 *
 * Tesseract lit bien mieux un texte noir sur fond blanc, net et assez grand (environ 20 à 30 px
 * de hauteur de lettre). Doc : https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html
 *
 * Les images manipulées ont la même forme qu'un `ImageData` du navigateur (RGBA, 4 octets par
 * pixel) : on peut passer un vrai `ImageData` ou un objet de test.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/ImageData
 */
export interface RgbaImage {
  readonly width: number
  readonly height: number
  /** RGBA, 4 octets par pixel, ligne par ligne. */
  readonly data: Uint8ClampedArray
}

/** Image en niveaux de gris : 1 octet par pixel (0 = noir, 255 = blanc). */
export interface GrayImage {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

/** Luminance perçue (coefficients de la recommandation ITU-R BT.601). */
export function toGrayscale(image: RgbaImage): GrayImage {
  const { width, height, data } = image
  const gray = new Uint8ClampedArray(width * height)
  for (let i = 0; i < gray.length; i += 1) {
    const r = data[i * 4] ?? 0
    const g = data[i * 4 + 1] ?? 0
    const b = data[i * 4 + 2] ?? 0
    gray[i] = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  }
  return { width, height, data: gray }
}

/** Agrandissement par interpolation bilinéaire (les petits caractères deviennent lisibles). */
export function upscale(image: GrayImage, factor: number): GrayImage {
  if (!Number.isFinite(factor) || factor <= 0) throw new RangeError('facteur invalide')
  const { width, height, data } = image
  const outWidth = Math.max(1, Math.round(width * factor))
  const outHeight = Math.max(1, Math.round(height * factor))
  const out = new Uint8ClampedArray(outWidth * outHeight)
  const at = (x: number, y: number) => data[y * width + x] ?? 0

  for (let y = 0; y < outHeight; y += 1) {
    // Centre du pixel de sortie ramené dans l'image source.
    const sy = Math.min(height - 1, Math.max(0, (y + 0.5) / factor - 0.5))
    const y0 = Math.floor(sy)
    const y1 = Math.min(height - 1, y0 + 1)
    const fy = sy - y0
    for (let x = 0; x < outWidth; x += 1) {
      const sx = Math.min(width - 1, Math.max(0, (x + 0.5) / factor - 0.5))
      const x0 = Math.floor(sx)
      const x1 = Math.min(width - 1, x0 + 1)
      const fx = sx - x0
      const top = at(x0, y0) * (1 - fx) + at(x1, y0) * fx
      const bottom = at(x0, y1) * (1 - fx) + at(x1, y1) * fx
      out[y * outWidth + x] = Math.round(top * (1 - fy) + bottom * fy)
    }
  }
  return { width: outWidth, height: outHeight, data: out }
}

/**
 * Étire le contraste : les 1 % de pixels les plus sombres deviennent noirs, les 1 % les plus
 * clairs deviennent blancs. Utile sous un éclairage faible ou une carte brillante.
 */
export function stretchContrast(image: GrayImage, clipRatio = 0.01): GrayImage {
  const histogram = computeHistogram(image)
  const clip = Math.floor(image.data.length * clipRatio)
  let low = 0
  for (let seen = 0; low < 255 && seen + (histogram[low] ?? 0) <= clip; low += 1) {
    seen += histogram[low] ?? 0
  }
  let high = 255
  for (let seen = 0; high > 0 && seen + (histogram[high] ?? 0) <= clip; high -= 1) {
    seen += histogram[high] ?? 0
  }
  if (high <= low) return image
  const out = new Uint8ClampedArray(image.data.length)
  const scale = 255 / (high - low)
  for (let i = 0; i < out.length; i += 1) out[i] = ((image.data[i] ?? 0) - low) * scale
  return { width: image.width, height: image.height, data: out }
}

export function computeHistogram(image: GrayImage): Uint32Array {
  const histogram = new Uint32Array(256)
  for (const value of image.data) histogram[value] = (histogram[value] ?? 0) + 1
  return histogram
}

/**
 * Seuil d'Otsu : choisit le niveau de gris qui sépare le mieux « encre » et « fond » en
 * maximisant la variance entre les deux classes.
 * Référence : N. Otsu, 1979 — https://fr.wikipedia.org/wiki/M%C3%A9thode_d%27Otsu
 */
export function otsuThreshold(image: GrayImage): number {
  const histogram = computeHistogram(image)
  const total = image.data.length
  if (total === 0) return 127
  let sumAll = 0
  for (let level = 0; level < 256; level += 1) sumAll += level * (histogram[level] ?? 0)

  let sumBackground = 0
  let weightBackground = 0
  let bestVariance = -1
  let threshold = 0
  for (let level = 0; level < 256; level += 1) {
    weightBackground += histogram[level] ?? 0
    if (weightBackground === 0) continue
    const weightForeground = total - weightBackground
    if (weightForeground === 0) break
    sumBackground += level * (histogram[level] ?? 0)
    const meanBackground = sumBackground / weightBackground
    const meanForeground = (sumAll - sumBackground) / weightForeground
    const variance = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2
    if (variance > bestVariance) {
      bestVariance = variance
      threshold = level
    }
  }
  return threshold
}

/** Noir (0) si le pixel est ≤ seuil, blanc (255) sinon. */
export function binarize(image: GrayImage, threshold: number): GrayImage {
  const out = new Uint8ClampedArray(image.data.length)
  for (let i = 0; i < out.length; i += 1) out[i] = (image.data[i] ?? 0) <= threshold ? 0 : 255
  return { width: image.width, height: image.height, data: out }
}

/**
 * Le texte occupe moins de surface que le fond : si le noir est majoritaire, c'est que le texte
 * est clair sur fond sombre (cadre Xyz par ex.). On inverse pour donner du noir sur blanc.
 */
export function ensureDarkTextOnLight(image: GrayImage): GrayImage {
  let dark = 0
  for (const value of image.data) if (value < 128) dark += 1
  if (dark <= image.data.length / 2) return image
  const out = new Uint8ClampedArray(image.data.length)
  for (let i = 0; i < out.length; i += 1) out[i] = 255 - (image.data[i] ?? 0)
  return { width: image.width, height: image.height, data: out }
}

/** Repasse en RGBA (pour `new ImageData(...)` puis un canvas). */
export function grayToRgba(image: GrayImage): RgbaImage {
  const out = new Uint8ClampedArray(image.data.length * 4)
  for (let i = 0; i < image.data.length; i += 1) {
    const value = image.data[i] ?? 0
    out[i * 4] = value
    out[i * 4 + 1] = value
    out[i * 4 + 2] = value
    out[i * 4 + 3] = 255
  }
  return { width: image.width, height: image.height, data: out }
}

export interface PreprocessOptions {
  /** Facteur d'agrandissement (×2 à ×3 conseillé pour un code de quelques pixels de haut). */
  scale?: number
  /** Binariser (Otsu). Désactivé pour le nom, souvent sur un fond dégradé. */
  threshold?: boolean
}

/** Chaîne complète : gris → contraste → agrandissement → seuil d'Otsu → noir sur blanc. */
export function preprocessForOcr(image: RgbaImage, options: PreprocessOptions = {}): RgbaImage {
  const { scale = 2, threshold = true } = options
  let gray = stretchContrast(toGrayscale(image))
  if (scale !== 1) gray = upscale(gray, scale)
  if (threshold) gray = binarize(gray, otsuThreshold(gray))
  return grayToRgba(ensureDarkTextOnLight(gray))
}

/** Facteur d'agrandissement pour viser une hauteur de zone donnée (borné entre 1 et 3). */
export function scaleForHeight(height: number, targetHeight: number): number {
  if (height <= 0) return 1
  return Math.min(3, Math.max(1, targetHeight / height))
}
