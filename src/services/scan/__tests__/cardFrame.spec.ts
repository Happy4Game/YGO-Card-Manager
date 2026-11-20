import { describe, expect, it } from 'vitest'
import {
  CARD_RATIO,
  CARD_ZONES,
  cardFrameInBox,
  clampRect,
  containerRectToMedia,
  zoneInFrame,
} from '../cardFrame'

describe('cardFrameInBox', () => {
  it('garde le format carte 59×86, centré, dans une boîte en portrait', () => {
    const frame = cardFrameInBox(300, 400, 0.84)
    expect(frame.width / frame.height).toBeCloseTo(CARD_RATIO, 5)
    expect(frame.height).toBeLessThanOrEqual(400 * 0.84 + 1e-9)
    expect(frame.x + frame.width / 2).toBeCloseTo(150)
    expect(frame.y + frame.height / 2).toBeCloseTo(200)
  })

  it('est limité par la hauteur dans une boîte en paysage', () => {
    const frame = cardFrameInBox(1000, 500, 1)
    expect(frame.height).toBe(500)
    expect(frame.width).toBeCloseTo(500 * CARD_RATIO)
  })
})

describe('zoneInFrame', () => {
  it('place la zone du code à droite, sous l’illustration', () => {
    const zone = zoneInFrame({ x: 10, y: 20, width: 590, height: 860 }, CARD_ZONES.code)
    expect(zone.x).toBeCloseTo(10 + 0.52 * 590)
    expect(zone.y).toBeCloseTo(20 + 0.69 * 860)
    expect(zone.x + zone.width).toBeLessThanOrEqual(10 + 590)
  })
})

describe('containerRectToMedia', () => {
  it('tient compte du rognage de object-fit: cover (vidéo 16:9 dans un conteneur 3:4)', () => {
    // Vidéo 1920×1080 affichée dans 300×400 : échelle 400/1080, débord horizontal rogné.
    const scale = 400 / 1080
    const rect = containerRectToMedia(
      { x: 0, y: 0, width: 300, height: 400 },
      { width: 300, height: 400 },
      { width: 1920, height: 1080 },
    )
    expect(rect.height).toBeCloseTo(1080)
    expect(rect.width).toBeCloseTo(300 / scale)
    expect(rect.x).toBeCloseTo((1920 - 300 / scale) / 2)
    expect(rect.y).toBeCloseTo(0)
  })
})

describe('clampRect', () => {
  it('arrondit et reste dans l’image', () => {
    expect(clampRect({ x: -5.4, y: 10.6, width: 200, height: 50 }, 100, 40)).toEqual({
      x: 0,
      y: 11,
      width: 100,
      height: 29,
    })
  })

  it('ne renvoie jamais un rectangle vide', () => {
    const rect = clampRect({ x: 500, y: 500, width: 0, height: 0 }, 100, 100)
    expect(rect.width).toBeGreaterThanOrEqual(1)
    expect(rect.height).toBeGreaterThanOrEqual(1)
  })
})
