import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import type { CardData } from '@/domain/card'
import { rememberDefaults } from '@/services/quickAdd'
import { makeCard } from '@/test/fixtures'
import CollectionEntryForm from '../CollectionEntryForm.vue'

const twoPrints = makeCard({
  sets: [
    { code: 'TST-FR001', name: 'Boîte de Test', rarity: 'Common' },
    { code: 'AUT-FR007', name: 'Autre Boîte', rarity: 'Ultra Rare' },
  ],
  setKeys: ['TST-001', 'AUT-007'],
})

function mountForm(card: CardData, initialSetCode?: string) {
  return mount(CollectionEntryForm, {
    props: {
      initialCardId: card.id,
      initialSetCode,
      locations: [],
      findCard: () => Promise.resolve(card),
    },
  })
}

/** Champ associé à un libellé (`label.control`, comme le lirait un lecteur d'écran). */
function selectValue(wrapper: ReturnType<typeof mountForm>, text: string) {
  const label = wrapper.findAll('label').find((node) => node.text() === text)
  return (label?.element as HTMLLabelElement | undefined)?.control as HTMLSelectElement | undefined
}

describe('CollectionEntryForm (ajout)', () => {
  beforeEach(() => localStorage.clear())

  it('présélectionne l’impression lue, même avec une autre région', async () => {
    const wrapper = mountForm(twoPrints, 'AUT-EN007')
    await flushPromises()
    expect(selectValue(wrapper, 'Impression')?.value).toBe('1')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      setCode: 'AUT-EN007',
      rarity: 'Ultra Rare',
    })
  })

  it('choisit la seule impression connue et reprend les derniers réglages', async () => {
    rememberDefaults({ language: 'en', condition: 'Played', location: 'Classeur bleu' })
    const wrapper = mountForm(makeCard())
    await flushPromises()
    expect(selectValue(wrapper, 'Impression')?.value).toBe('0')
    expect(selectValue(wrapper, 'Langue')?.value).toBe('en')
    expect(selectValue(wrapper, 'État')?.value).toBe('Played')
  })

  it('ne devine pas entre plusieurs impressions sans indice', async () => {
    const wrapper = mountForm(twoPrints)
    await flushPromises()
    expect(selectValue(wrapper, 'Impression')?.value).toBe('free')
  })
})
