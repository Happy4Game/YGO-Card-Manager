import { describe, expect, it } from 'vitest'
import { advancedFromQuery, applyAdvanced, emptyAdvancedState } from '../advancedQuery'

describe('advancedFromQuery', () => {
  it('renvoie un état vide pour une saisie vide', () => {
    expect(advancedFromQuery('')).toEqual(emptyAdvancedState())
  })

  it('lit chaque contrôle depuis la saisie', () => {
    const state = advancedFromQuery(
      'dragon "blanc fictif" texte:pioche #12 LOB-FR001 type:monstre type:xyz type:syntoniseur ' +
        'attr:lumière race:guerrier arch:"Héros Fictif" set:TST rarete:ultra ' +
        'fleche:haut,bas atk>=1000 atk<=2500 niv:4 lien:2-3 echelle<=5 in:collection',
    )
    expect(state).toEqual({
      name: 'dragon "blanc fictif"',
      text: 'pioche',
      passcode: '12',
      printCode: 'LOB-FR001',
      category: 'Monster',
      kinds: ['XYZ', 'Tuner'],
      attribute: 'LIGHT',
      race: 'Warrior',
      archetype: 'Héros Fictif',
      set: 'TST',
      rarity: 'ultra',
      markers: ['Top', 'Bottom'],
      ranges: {
        atk: { min: '1000', max: '2500' },
        def: { min: '', max: '' },
        level: { min: '4', max: '4' },
        link: { min: '2', max: '3' },
        scale: { min: '', max: '5' },
      },
      owned: true,
    })
  })

  it('ignore ce qui n’est pas représentable (exclusions, listes)', () => {
    const state = advancedFromQuery('-dragon -type:effet attr:feu,eau')
    expect(state.name).toBe('')
    expect(state.kinds).toEqual([])
    expect(state.attribute).toBe('')
  })
})

describe('applyAdvanced', () => {
  it('ajoute un filtre en fin de saisie, en français', () => {
    expect(applyAdvanced('dragon', { key: 'attribute', value: 'DARK' })).toBe(
      'dragon attr:tenebres',
    )
    expect(applyAdvanced('', { key: 'race', value: 'Winged Beast' })).toBe('race:bete-ailee')
    expect(applyAdvanced('', { key: 'race', value: 'Inconnue Bizarre' })).toBe(
      'race:"Inconnue Bizarre"',
    )
  })

  it('remplace le jeton existant à sa place', () => {
    expect(applyAdvanced('attr:feu dragon', { key: 'attribute', value: 'WATER' })).toBe(
      'attr:eau dragon',
    )
    expect(applyAdvanced('attr:feu dragon', { key: 'attribute', value: '' })).toBe('dragon')
  })

  it('conserve les jetons tapés à la main', () => {
    expect(applyAdvanced('-type:effet attr:feu,eau', { key: 'kinds', value: ['XYZ'] })).toBe(
      '-type:effet attr:feu,eau type:xyz',
    )
  })

  it('écrit les bornes numériques', () => {
    let query = applyAdvanced('', { key: 'range', field: 'atk', bound: 'min', value: '2000' })
    expect(query).toBe('atk>=2000')
    query = applyAdvanced(query, { key: 'range', field: 'atk', bound: 'max', value: '3000' })
    expect(query).toBe('atk:2000-3000')
    query = applyAdvanced(query, { key: 'range', field: 'atk', bound: 'min', value: '' })
    expect(query).toBe('atk<=3000')
    query = applyAdvanced(query, { key: 'range', field: 'level', bound: 'min', value: '4' })
    query = applyAdvanced(query, { key: 'range', field: 'level', bound: 'max', value: '4' })
    expect(query).toBe('atk<=3000 niv:4')
    expect(applyAdvanced('', { key: 'range', field: 'def', bound: 'min', value: 'abc' })).toBe('')
  })

  it('le nom remplace le texte libre et se place en tête', () => {
    expect(applyAdvanced('atk>=1000 golem -brisé', { key: 'name', value: 'dragon blanc' })).toBe(
      'atk>=1000 dragon blanc -brisé',
    )
    expect(applyAdvanced('atk>=1000', { key: 'name', value: 'dragon' })).toBe('dragon atk>=1000')
    // Un mot qui ressemble à un filtre est protégé par des guillemets.
    expect(applyAdvanced('', { key: 'name', value: 'atk:1 dragon' })).toBe('"atk:1" dragon')
  })

  it('catégorie, types, flèches et collection', () => {
    let query = applyAdvanced('', { key: 'category', value: 'Spell' })
    expect(query).toBe('type:magie')
    query = applyAdvanced(query, { key: 'category', value: 'Monster' })
    query = applyAdvanced(query, { key: 'kinds', value: ['Effect', 'Pendulum'] })
    expect(query).toBe('type:monstre type:effet type:pendule')
    query = applyAdvanced(query, { key: 'markers', value: ['Bottom', 'Top-Left'] })
    expect(query).toBe('type:monstre type:effet type:pendule fleche:haut-gauche,bas')
    query = applyAdvanced(query, { key: 'owned', value: true })
    expect(query.endsWith('in:collection')).toBe(true)
    expect(applyAdvanced(query, { key: 'owned', value: false }).includes('in:')).toBe(false)
  })

  it('passcode, code d’impression, texte, archétype, extension, rareté', () => {
    expect(applyAdvanced('', { key: 'passcode', value: '123, 45 x' })).toBe('#123 #45')
    expect(applyAdvanced('', { key: 'printCode', value: 'lob-fr001 lob' })).toBe(
      'LOB-FR001 code:LOB',
    )
    expect(applyAdvanced('code:LOB', { key: 'printCode', value: '' })).toBe('')
    expect(applyAdvanced('', { key: 'text', value: 'piochez 2' })).toBe('texte:"piochez 2"')
    expect(applyAdvanced('', { key: 'archetype', value: 'Fictif' })).toBe('arch:Fictif')
    expect(applyAdvanced('', { key: 'set', value: 'TST' })).toBe('set:TST')
    expect(applyAdvanced('', { key: 'rarity', value: 'Ultra Rare' })).toBe('rarete:"Ultra Rare"')
  })

  it('aller-retour : relire la saisie produite redonne la valeur', () => {
    const query = applyAdvanced('', { key: 'archetype', value: 'Héros Fictif' })
    expect(advancedFromQuery(query).archetype).toBe('Héros Fictif')
    const markers = applyAdvanced('', { key: 'markers', value: ['Right', 'Top'] })
    expect(advancedFromQuery(markers).markers).toEqual(['Top', 'Right'])
  })
})
