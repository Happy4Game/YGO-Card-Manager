import { flushPromises, mount } from '@vue/test-utils'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import type { CardData } from '@/domain/card'
import { rememberDefaults } from '@/services/quickAdd'
import { makeCard } from '@/test/fixtures'
import CollectionEntryForm from '../CollectionEntryForm.vue'

// Base dédiée à ce fichier (la liste des raretés la lit).
vi.mock('@/db/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/database')>()
  return { ...original, db: new original.AppDatabase('test-entry-form') }
})

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
  afterAll(async () => {
    await db.delete()
  })

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

  it('propose les raretés existantes, celles de la carte en premier, et une saisie libre', async () => {
    await db.cards.bulkPut([
      twoPrints,
      makeCard({ id: 2, sets: [{ code: 'XYZ-FR001', name: 'X', rarity: 'Secret Rare' }] }),
    ])
    const wrapper = mountForm(twoPrints, 'AUT-FR007')
    await flushPromises()

    // IndexedDB répond de façon asynchrone : on attend que la liste soit remplie.
    await vi.waitFor(() => expect(wrapper.findAll('optgroup')).toHaveLength(2))
    const rarity = selectValue(wrapper, 'Rareté')
    expect(rarity?.value).toBe('Ultra Rare')
    const groups = wrapper.findAll('optgroup')
    expect(groups.map((group) => group.attributes('label'))).toEqual([
      'Raretés de cette carte',
      'Toutes les raretés',
    ])
    expect(groups[0]?.findAll('option').map((option) => option.text())).toEqual([
      'Common',
      'Ultra Rare',
    ])
    expect(groups[1]?.findAll('option').map((option) => option.text())).toEqual(['Secret Rare'])

    // Une autre rareté que celle de l'impression : modifiable.
    const select = wrapper.find(`select#${rarity?.id ?? ''}`)
    await select.setValue('Secret Rare')
    // « Autre » ouvre un champ libre.
    await select.setValue('__other__')
    await wrapper.find('input[placeholder="ex. Starlight Rare"]').setValue(' Rareté Maison ')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ rarity: 'Rareté Maison' })
    await db.cards.clear()
  })
})
