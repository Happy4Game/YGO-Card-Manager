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
  return (label?.element as HTMLLabelElement | undefined)?.control as
    | HTMLSelectElement
    | HTMLInputElement
    | undefined
}

describe('CollectionEntryForm (ajout)', () => {
  beforeEach(() => localStorage.clear())
  afterAll(async () => {
    await db.delete()
  })

  it('pré-remplit le code lu et sa rareté, même avec une autre région', async () => {
    const wrapper = mountForm(twoPrints, 'AUT-EN007')
    await flushPromises()
    expect(selectValue(wrapper, 'Code de la carte')?.value).toBe('AUT-EN007')
    expect(selectValue(wrapper, 'Rareté')?.value).toBe('Ultra Rare')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({
      setCode: 'AUT-EN007',
      rarity: 'Ultra Rare',
    })
  })

  it('prend la seule impression connue et reprend les derniers réglages', async () => {
    rememberDefaults({ language: 'en', condition: 'Played', location: 'Classeur bleu' })
    const wrapper = mountForm(makeCard())
    await flushPromises()
    expect(selectValue(wrapper, 'Code de la carte')?.value).toBe('TST-FR001')
    expect(selectValue(wrapper, 'Rareté')?.value).toBe('Common')
    expect(selectValue(wrapper, 'Langue')?.value).toBe('en')
    expect(selectValue(wrapper, 'État')?.value).toBe('Played')
  })

  it('demande le code quand plusieurs impressions existent, puis propose sa rareté', async () => {
    const wrapper = mountForm(twoPrints)
    await flushPromises()
    const code = wrapper.find(`input#${selectValue(wrapper, 'Code de la carte')?.id ?? ''}`)
    expect((code.element as HTMLInputElement).value).toBe('')

    // Sans code : envoi refusé, avec un message sous le champ.
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')).toBeUndefined()
    expect(wrapper.text()).toContain('Indique le code imprimé sur la carte')

    // Format invalide : expliqué.
    await code.setValue('lob001')
    expect(wrapper.text()).toContain('Format attendu')

    // Code reconnu (en minuscules, autre langue) : rareté proposée.
    await code.setValue('aut-de007')
    expect((code.element as HTMLInputElement).value).toBe('AUT-DE007')
    expect(selectValue(wrapper, 'Rareté')?.value).toBe('Ultra Rare')
    expect(wrapper.text()).toContain('Autre Boîte')
  })

  it('propose les raretés existantes, celles de la carte en premier, et une saisie libre', async () => {
    await db.cards.bulkPut([
      twoPrints,
      makeCard({ id: 2, sets: [{ code: 'XYZ-FR001', name: 'X', rarity: 'Secret Rare' }] }),
    ])
    const wrapper = mountForm(twoPrints, 'AUT-FR007')
    // IndexedDB répond de façon asynchrone : on attend que la liste soit remplie.
    await vi.waitFor(() => expect(wrapper.findAll('optgroup')).toHaveLength(2))
    const rarity = selectValue(wrapper, 'Rareté')
    expect(rarity?.value).toBe('Ultra Rare')
    const groups = wrapper.findAll('optgroup')
    expect(groups.map((group) => group.attributes('label'))).toEqual([
      'Raretés de cette carte',
      'Toutes les raretés',
    ])
    // Le code désigne une impression : seules ses raretés sont « de cette carte ».
    expect(groups[0]?.findAll('option').map((option) => option.text())).toEqual(['Ultra Rare'])
    expect(groups[1]?.findAll('option').map((option) => option.text())).toEqual([
      'Common',
      'Secret Rare',
    ])

    // « Autre » ouvre un champ libre.
    const select = wrapper.find(`select#${rarity?.id ?? ''}`)
    await select.setValue('__other__')
    await wrapper.find('input[placeholder="ex. Starlight Rare"]').setValue(' Rareté Maison ')
    await wrapper.find('form').trigger('submit')
    expect(wrapper.emitted('submit')?.[0]?.[0]).toMatchObject({ rarity: 'Rareté Maison' })
    await db.cards.clear()
  })
})
