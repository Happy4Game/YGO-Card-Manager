import type { CardFrameType } from './cardFrameType'
import type { CardType } from './cardType'

export class Card {
  id: number
  name: string
  type: CardType
  frameType: CardFrameType
  desc: string
  ygoprodeck_url: string
  card_prices: string

  constructor(
    id: number,
    name: string,
    type: CardType,
    frameType: CardFrameType,
    desc: string,
    ygoprodeck_url: string,
    card_prices: string,
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
