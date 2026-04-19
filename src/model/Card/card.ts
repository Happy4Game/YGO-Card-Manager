import type { CardFrameType } from './cardFrameType'
import type { CardPrice } from './cardPrice'
import type { CardType } from './cardType'

export class Card {
  id: number
  name: string
  type: CardType
  frameType: CardFrameType
  desc: string
  ygoprodeck_url: string
  card_prices: CardPrice

  constructor(
    id: number,
    name: string,
    type: CardType,
    frameType: CardFrameType,
    desc: string,
    ygoprodeck_url: string,
    card_prices: CardPrice,
  ) {
    this.id = id
    this.name = name
    this.type = type
    this.frameType = frameType
    this.desc = desc
    this.ygoprodeck_url = ygoprodeck_url
    this.card_prices = card_prices
  }
}
