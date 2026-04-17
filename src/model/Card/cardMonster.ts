import { Card } from './card'
import type { CardRace } from './cardRace'

export class CardMonster extends Card {
  atk: number
  def: number
  level: number
  race: CardRace
  attribute: string

  constructor(
    card: Card,
    atk: number,
    def: number,
    level: number,
    race: CardRace,
    attribute: string,
  ) {
    super(
      card.id,
      card.name,
      card.type,
      card.frameType,
      card.desc,
      card.ygoprodeck_url,
      card.card_prices,
    )
    this.atk = atk
    this.def = def
    this.level = level
    this.race = race
    this.attribute = attribute
  }
}
