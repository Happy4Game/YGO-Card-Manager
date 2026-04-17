import { Card } from './card'

export class CardAchetype extends Card {
  archetype: string
  constructor(card: Card, archetype: string) {
    super(
      card.id,
      card.name,
      card.type,
      card.frameType,
      card.desc,
      card.ygoprodeck_url,
      card.card_prices,
    )
    this.archetype = archetype
  }
}
