import { describe, expect, it } from 'vitest'
import { YGOProDeckDTO } from '../ygoProDeckDTO'
import { CardMonster } from '@/model/Card/cardMonster'
import { CardLink } from '@/model/Card/cardLink'
import { CardPendulum } from '@/model/Card/cardPendulum'
import { CardSpell } from '@/model/Card/cardSpell'

// Données fictives : on ne versionne aucun texte réel de carte (voir README, section légale).
const base = {
  id: 1,
  name: 'Carte de test',
  type: 'Effect Monster',
  frameType: 'effect',
  desc: 'Description fictive.',
  ygoprodeck_url: 'https://ygoprodeck.com/card/test',
  card_prices: [
    {
      cardmarket_price: 0,
      coolstuffinc_price: 0,
      tcgplayer_price: '0',
      ebay_price: '0',
      amazon_price: 0,
    },
  ],
}

const monster = { ...base, atk: 1000, def: 500, level: 4, race: 'Warrior', attribute: 'LIGHT' }

describe('YGOProDeckDTO.convertObjectToCard', () => {
  const dto = new YGOProDeckDTO()

  it('convertit un monstre', () => {
    const card = dto.convertObjectToCard(monster)
    expect(card).toBeInstanceOf(CardMonster)
    expect(card).toMatchObject({ atk: 1000, def: 500, level: 4, attribute: 'LIGHT' })
  })

  it('convertit un monstre pendule', () => {
    const card = dto.convertObjectToCard({ ...monster, scale: 5 })
    expect(card).toBeInstanceOf(CardPendulum)
    expect(card).toMatchObject({ scale: 5 })
  })

  it('convertit un monstre lien', () => {
    const card = dto.convertObjectToCard({ ...monster, linkval: '2', linkmarkers: ['Top'] })
    expect(card).toBeInstanceOf(CardLink)
    expect(card).toMatchObject({ linkval: '2', linkmarkers: ['Top'] })
  })

  it('convertit une magie', () => {
    const card = dto.convertObjectToCard({ ...base, type: 'Spell Card', race: 'Normal' })
    expect(card).toBeInstanceOf(CardSpell)
    expect(card).toMatchObject({ race: 'Normal' })
  })

  it('garde le premier prix', () => {
    const card = dto.convertObjectToCard(monster)
    expect(card.card_prices.cardmarket_price).toBe(0)
  })
})
