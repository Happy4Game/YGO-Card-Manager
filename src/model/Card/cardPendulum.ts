import { CardMonster } from './cardMonster'

export class CardPendulum extends CardMonster {
  scale: number
  constructor(card: CardMonster, scale: number) {
    super(card, card.atk, card.def, card.level, card.race, card.attribute)
    this.scale = scale
  }
}
