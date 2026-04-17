import type { CardSearchParameters } from '@/model/Card/cardSearchParameter'
import { Card } from '@/model/Card/card'
import { CardAchetype } from '@/model/Card/cardArchetype'
import { CardLink } from '@/model/Card/cardLink'
import { CardMonster } from '@/model/Card/cardMonster'
import { CardPendulum } from '@/model/Card/cardPendulum'
import { CardSpell } from '@/model/Card/cardSpell'
import axios from 'axios'

export class YGOProDeckDTO {
  async list(options: CardSearchParameters) {
    let queryString = ''
    for (const [key, value] of Object.entries(options)) {
      if (!(key === 'language' && value === 'en')) queryString += `${key}=${value.toString()}&`
    }

    const response = await axios.get(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${queryString}`)
    const responseArray: Array<Card> = []
    for (const obj of response.data.data) {
      responseArray.push(this.convertObjectToCard(obj))
    }
    return responseArray
  }

  convertObjectToCard(obj: object) {
    const ygoCard: object = obj
    const ygoCardKeys: Array<string> = Object.keys(ygoCard)

    const basicCard: Card = new Card(
      ygoCard.id,
      ygoCard.name,
      ygoCard.type,
      ygoCard.frameType,
      ygoCard.desc,
      ygoCard.ygoprodeck_url,
      ygoCard.card_prices,
    )
    if (ygoCardKeys.includes('atk')) {
      let monsterCard: CardMonster = new CardMonster(
        basicCard,
        ygoCard.atk,
        ygoCard.def,
        ygoCard.level,
        ygoCard.race,
        ygoCard.attribute,
      )
      if (ygoCardKeys.includes('scale')) return new CardPendulum(monsterCard, ygoCard.scale)
      if (ygoCardKeys.includes('linkval'))
        return new CardLink(monsterCard, ygoCard.linkval, ygoCard.linkmarkers)
    } else if (ygoCardKeys.includes('archetype')) {
      return new CardAchetype(basicCard, ygoCard.archetype)
    } else {
      return new CardSpell(basicCard, ygoCard.race)
    }
    return basicCard
  }
}
