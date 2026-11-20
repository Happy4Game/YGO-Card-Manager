import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '@/db/database'
import { lastOf, makeCard } from '@/test/fixtures'
import SearchPage from '../SearchPage.vue'

// Base dédiée à ce fichier (le moteur de recherche partagé l'utilise aussi).
vi.mock('@/db/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/db/database')>()
  return { ...original, db: new original.AppDatabase('test-search-page') }
})

function mountPage() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return mount(SearchPage, { global: { plugins: [pinia] }, attachTo: document.body })
}

describe('SearchPage', () => {
  beforeEach(async () => {
    sessionStorage.clear()
    await db.cards.clear()
  })

  afterAll(async () => {
    await db.delete()
  })

  it('propose le téléchargement quand aucune carte n’est enregistrée', async () => {
    const wrapper = mountPage()
    await flushPromises()
    expect(wrapper.text()).toContain('Télécharger / mettre à jour les cartes')
    expect(wrapper.find('#universal-search').exists()).toBe(false)
    wrapper.unmount()
  })

  it('cherche en direct et affiche les puces comprises', async () => {
    await db.cards.bulkPut([
      makeCard({ id: 1, name: 'Golem de Test', atk: 2500 }),
      makeCard({ id: 2, name: 'Sort Imaginaire', type: 'Spell Card', race: 'Normal' }),
    ])
    const wrapper = mountPage()
    await vi.waitFor(() => expect(wrapper.find('[role="status"]').text()).toBe('2 cartes'))

    await wrapper.get('#universal-search').setValue('golem atk>=2000')
    await vi.waitFor(() => expect(wrapper.find('.results [role="status"]').text()).toBe('1 carte'))
    expect(wrapper.text()).toContain('ATK ≥ 2000')
    expect(wrapper.get('a.add').attributes('href')).toBe('/collection/?add=1')

    // Retirer la puce « ATK ≥ 2000 » réécrit la saisie.
    await lastOf(wrapper.findAll('button.remove'))?.trigger('click')
    const input = wrapper.get<HTMLInputElement>('#universal-search')
    expect(input.element.value).toBe('golem')
    expect(sessionStorage.getItem('search:last')).toContain('golem')

    // L'aide s'ouvre et un exemple remplit le champ.
    const help = wrapper.get('.help-button')
    await help.trigger('click')
    expect(help.attributes('aria-expanded')).toBe('true')
    await wrapper.get('.help .example').trigger('click')
    expect(input.element.value).toBe('dragon blanc')
    wrapper.unmount()
  })
})
