import { Card } from './card'
import type { CardRace } from './cardRace'

export class CardSpell extends Card {
  race: CardRace
  constructor(card: Card, race: CardRace) {
    super(
      card.id,
      card.name,
      card.type,
      card.frameType,
      card.desc,
      card.ygoprodeck_url,
      card.card_prices,
    )
    this.race = race
  }
}
