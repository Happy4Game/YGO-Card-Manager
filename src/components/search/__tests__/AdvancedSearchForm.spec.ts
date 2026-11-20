import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { lastOf } from '@/test/fixtures'
import AdvancedSearchForm from '../AdvancedSearchForm.vue'

function mountForm(query: string) {
  return mount(AdvancedSearchForm, { props: { query, facets: null } })
}

describe('AdvancedSearchForm', () => {
  it('réécrit la saisie quand on change l’ATK minimale', async () => {
    const wrapper = mountForm('dragon')
    const atkMin = wrapper.get('[aria-labelledby="adv-atk-label"] input')
    await atkMin.setValue('2000')
    expect(lastOf(wrapper.emitted('update:query'))).toEqual(['dragon atk>=2000'])
  })

  it('reflète la saisie universelle dans les contrôles', async () => {
    const wrapper = mountForm('attr:feu niv:4 fleche:haut type:xyz')
    const selects = wrapper.findAll<HTMLSelectElement>('select')
    expect(selects.map((s) => s.element.value)).toContain('FIRE')
    const levelMin = wrapper.get<HTMLInputElement>('[aria-labelledby="adv-level-label"] input')
    expect(levelMin.element.value).toBe('4')
    const top = wrapper.get('button[title="Haut"]')
    expect(top.attributes('aria-pressed')).toBe('true')
    const xyz = wrapper.findAll('.toggle').find((b) => b.text() === 'XYZ')
    expect(xyz?.attributes('aria-pressed')).toBe('true')

    await wrapper.setProps({ query: 'niv:7' })
    expect(levelMin.element.value).toBe('7')
    expect(top.attributes('aria-pressed')).toBe('false')
  })

  it('les boutons de flèches ajoutent un filtre', async () => {
    const wrapper = mountForm('')
    await wrapper.get('button[title="Bas-gauche"]').trigger('click')
    expect(lastOf(wrapper.emitted('update:query'))).toEqual(['fleche:bas-gauche'])
  })

  it('garde l’espace finale pendant la frappe du nom', async () => {
    const wrapper = mountForm('')
    const name = wrapper.get<HTMLInputElement>('input[type="text"]')
    await name.setValue('dragon ')
    const emitted = lastOf(wrapper.emitted('update:query'))?.[0]
    expect(emitted).toBe('dragon')
    await wrapper.setProps({ query: typeof emitted === 'string' ? emitted : '' })
    expect(name.element.value).toBe('dragon ')
  })
})
