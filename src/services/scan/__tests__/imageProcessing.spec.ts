import { describe, expect, it } from 'vitest'
import {
  adaptiveThreshold,
  binarize,
  ensureDarkTextOnLight,
  grayToRgba,
  otsuThreshold,
  preprocessForOcr,
  scaleForHeight,
  stretchContrast,
  toGrayscale,
  upscale,
  type GrayImage,
  type RgbaImage,
} from '../imageProcessing'

/** Image RGBA synthétique remplie par une fonction (x, y) → [r, g, b]. */
function rgba(width: number, height: number, fill: (x: number, y: number) => number[]): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r = 0, g = 0, b = 0] = fill(x, y)
      data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  return { width, height, data }
}

const gray = (width: number, height: number, values: number[]): GrayImage => ({
  width,
  height,
  data: Uint8ClampedArray.from(values),
})

describe('toGrayscale', () => {
  it('applique les coefficients BT.601', () => {
    const image = rgba(
      3,
      1,
      (x) =>
        [
          [255, 0, 0],
          [0, 255, 0],
          [255, 255, 255],
        ][x] ?? [0, 0, 0],
    )
    expect([...toGrayscale(image).data]).toEqual([76, 150, 255])
  })
})

describe('upscale', () => {
  it('multiplie les dimensions et conserve une image uniforme', () => {
    const out = upscale(gray(2, 2, [80, 80, 80, 80]), 3)
    expect(out.width).toBe(6)
    expect(out.height).toBe(6)
    expect(new Set(out.data)).toEqual(new Set([80]))
  })

  it('interpole entre deux pixels (dégradé croissant)', () => {
    const out = upscale(gray(2, 1, [0, 200]), 2)
    expect(out.height).toBe(2)
    expect(Array.from(out.data.subarray(0, 4))).toEqual([0, 50, 150, 200])
  })

  it('refuse un facteur invalide', () => {
    expect(() => upscale(gray(1, 1, [0]), 0)).toThrow(RangeError)
  })
})

describe('otsuThreshold / binarize', () => {
  it('sépare deux populations de gris', () => {
    const image = gray(8, 1, [30, 32, 35, 31, 200, 210, 205, 199])
    const threshold = otsuThreshold(image)
    expect(threshold).toBeGreaterThanOrEqual(35)
    expect(threshold).toBeLessThan(199)
    expect([...binarize(image, threshold).data]).toEqual([0, 0, 0, 0, 255, 255, 255, 255])
  })

  it('reste défini sur une image vide ou uniforme', () => {
    expect(otsuThreshold(gray(0, 0, []))).toBe(127)
    expect(Number.isFinite(otsuThreshold(gray(2, 1, [90, 90])))).toBe(true)
  })
})

describe('stretchContrast', () => {
  it('étire un contraste faible sur toute la plage', () => {
    const out = stretchContrast(gray(4, 1, [100, 110, 120, 130]), 0)
    expect(out.data[0]).toBe(0)
    expect(out.data[3]).toBe(255)
  })

  it('laisse une image uniforme inchangée', () => {
    const image = gray(2, 1, [50, 50])
    expect(stretchContrast(image)).toBe(image)
  })
})

describe('ensureDarkTextOnLight', () => {
  it('inverse un texte clair sur fond sombre', () => {
    const out = ensureDarkTextOnLight(gray(4, 1, [0, 0, 0, 255]))
    expect([...out.data]).toEqual([255, 255, 255, 0])
  })

  it('garde un texte sombre sur fond clair', () => {
    const image = gray(4, 1, [255, 255, 255, 0])
    expect(ensureDarkTextOnLight(image)).toBe(image)
  })
})

describe('grayToRgba', () => {
  it('produit des pixels opaques', () => {
    expect([...grayToRgba(gray(1, 1, [42])).data]).toEqual([42, 42, 42, 255])
  })
})

describe('preprocessForOcr', () => {
  it('donne un « texte » noir sur blanc, agrandi, même depuis un texte clair sur fond sombre', () => {
    // Fond sombre bleuté, « trait » clair vertical au centre (colonne 4 sur 10).
    const image = rgba(10, 4, (x) => (x === 4 ? [230, 230, 220] : [20, 30, 60]))
    const out = preprocessForOcr(image, { scale: 2 })
    expect(out.width).toBe(20)
    expect(out.height).toBe(8)
    const values = new Set<number>()
    for (let i = 0; i < out.data.length; i += 4) values.add(out.data[i] ?? -1)
    expect(values).toEqual(new Set([0, 255]))
    // Le fond (coin) est blanc, le trait est noir.
    expect(out.data[0]).toBe(255)
    expect(out.data[9 * 4]).toBe(0) // 1re ligne, colonne 9 : dans le trait agrandi
  })

  it('sans seuil, garde des niveaux de gris', () => {
    const image = rgba(4, 1, (x) => [x * 60, x * 60, x * 60])
    const out = preprocessForOcr(image, { scale: 1, threshold: false })
    expect(out.width).toBe(4)
    expect(new Set(out.data).size).toBeGreaterThan(2)
  })
})

describe('scaleForHeight', () => {
  it('borne le facteur entre 1 et 3', () => {
    expect(scaleForHeight(20, 96)).toBe(3)
    expect(scaleForHeight(48, 96)).toBe(2)
    expect(scaleForHeight(200, 96)).toBe(1)
    expect(scaleForHeight(0, 96)).toBe(1)
  })
})

describe('adaptiveThreshold', () => {
  // Bande gauche sombre (fond), bande droite claire avec un trait d'« encre » au milieu :
  // un seuil global confondrait le fond sombre avec l'encre ; le seuil local, non.
  const width = 12
  const height = 5
  const data = new Uint8ClampedArray(width * height)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) data[y * width + x] = x < 6 ? 40 : x === 9 ? 120 : 220
  }
  const image = { width, height, data }

  it('ne garde que ce qui est plus sombre que son voisinage', () => {
    const out = adaptiveThreshold(image, { radius: 2, offset: 12 })
    const row = out.data.slice(2 * width, 3 * width)
    // Fond sombre uniforme : blanc. Trait plus sombre que la zone claire : noir.
    expect(Array.from(row.slice(0, 4))).toEqual([255, 255, 255, 255])
    expect(row[9]).toBe(0)
    expect(row[11]).toBe(255)
  })

  it('sait lire un texte clair sur fond sombre (polarité inversée)', () => {
    const light = { width, height, data: data.map((value) => 255 - value) }
    const out = adaptiveThreshold(light, { radius: 2, offset: 12, polarity: 'light' })
    expect(out.data[2 * width + 9]).toBe(0)
    expect(out.data[2 * width + 1]).toBe(255)
  })
})
