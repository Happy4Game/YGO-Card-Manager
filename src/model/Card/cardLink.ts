import { CardMonster } from './cardMonster'

export class CardLink extends CardMonster {
  linkval: string
  linkmarkers: Array<string>

  constructor(card: CardMonster, linkval: string, linkmarkers: Array<string>) {
    super(card, card.atk, card.def, card.level, card.race, card.attribute)
    this.linkval = linkval
    this.linkmarkers = linkmarkers
  }
}
