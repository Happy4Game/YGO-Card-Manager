import type { CardSearchParameters } from '@/model/Card/cardSearchParameter'
import { Card } from '@/model/Card/card'
import { CardAchetype } from '@/model/Card/cardArchetype'
import type { CardFrameType } from '@/model/Card/cardFrameType'
import type { CardPrice } from '@/model/Card/cardPrice'
import type { CardRace } from '@/model/Card/cardRace'
import type { CardType } from '@/model/Card/cardType'
import { CardLink } from '@/model/Card/cardLink'
import { CardMonster } from '@/model/Card/cardMonster'
import { CardPendulum } from '@/model/Card/cardPendulum'
import { CardSpell } from '@/model/Card/cardSpell'
import axios from 'axios'

type YgoProDeckCard = {
  id: number
  name: string
  type: string
  frameType: string
  desc: string
  ygoprodeck_url: string
  card_prices: CardPrice[]
  atk?: number
  def?: number
  level?: number
  race?: string
  attribute?: string
  scale?: number
  linkval?: string
  linkmarkers?: Array<string>
  archetype?: string
}

export class YGOProDeckDTO {
  async list(options: CardSearchParameters) {
    let queryString = ''
    for (const [key, value] of Object.entries(options)) {
      if (!(key === 'language' && value === 'en')) queryString += `${key}=${value.toString()}&`
    }

    const response = await axios.get(`https://db.ygoprodeck.com/api/v7/cardinfo.php?${queryString}`)
    const responseArray: Array<Card | CardLink | CardAchetype | CardPendulum | CardSpell> = []
    for (const obj of response.data.data) {
      responseArray.push(this.convertObjectToCard(obj))
    }
    return responseArray
  }

  convertObjectToCard(obj: unknown) {
    const ygoCard = obj as YgoProDeckCard
    const ygoCardKeys: Array<string> = Object.keys(ygoCard)

    const basicCard: Card = new Card(
      ygoCard.id,
      ygoCard.name,
      ygoCard.type as CardType,
      ygoCard.frameType as unknown as CardFrameType,
      ygoCard.desc,
      ygoCard.ygoprodeck_url,
      ygoCard.card_prices[0]!,
    )
    if (ygoCardKeys.includes('atk')) {
      const monsterCard: CardMonster = new CardMonster(
        basicCard,
        ygoCard.atk!,
        ygoCard.def!,
        ygoCard.level!,
        ygoCard.race as CardRace,
        ygoCard.attribute!,
      )
      if (ygoCardKeys.includes('scale')) return new CardPendulum(monsterCard, ygoCard.scale!)
      if (ygoCardKeys.includes('linkval')) {
        return new CardLink(monsterCard, ygoCard.linkval!, ygoCard.linkmarkers!)
      }
      return monsterCard
    } else if (ygoCardKeys.includes('archetype')) {
      return new CardAchetype(basicCard, ygoCard.archetype!)
    } else {
      return new CardSpell(basicCard, ygoCard.race as CardRace)
    }
  }
}
