import { describe, expect, it } from 'vitest'
import { parseQuery, parseToken, quoteValue, removeToken, tokenize } from '../queryParser'

describe('tokenize', () => {
  it('sépare sur les espaces en gardant les guillemets', () => {
    expect(tokenize('  atk>=2500 arch:"Héros Fictif"  -"mot exclu" dragon ')).toEqual([
      'atk>=2500',
      'arch:"Héros Fictif"',
      '-"mot exclu"',
      'dragon',
    ])
  })

  it('tolère un guillemet non fermé', () => {
    expect(tokenize('"dragon blanc')).toEqual(['"dragon blanc'])
    expect(parseQuery('"dragon blanc').query.phrases).toEqual(['dragon blanc'])
  })

  it('renvoie une liste vide pour une saisie vide', () => {
    expect(tokenize('   ')).toEqual([])
    expect(parseQuery('').isEmpty).toBe(true)
  })
})

describe('mots libres', () => {
  it('normalise accents, majuscules et ponctuation', () => {
    const { query } = parseQuery('ÉLAN Électrique Blue-Eyes')
    expect(query.words).toEqual(['elan', 'electrique', 'blue', 'eyes'])
    expect(query.freeText).toBe('elan electrique blue eyes')
  })

  it('gère expressions exactes et exclusions', () => {
    const { query, chips } = parseQuery('golem "de pierre" -brisé -"texte interdit"')
    expect(query.words).toEqual(['golem'])
    expect(query.phrases).toEqual(['de pierre'])
    expect(query.excluded).toEqual(['brise', 'texte interdit'])
    expect(chips.map((c) => c.label)).toEqual([
      '« golem »',
      'Expression « de pierre »',
      'Sans « brise »',
      'Sans Expression « texte interdit »',
    ])
    expect(chips[2]?.negate).toBe(true)
  })

  it('un tiret seul ou de la ponctuation seule sont ignorés', () => {
    const parsed = parseQuery('- ... !!')
    expect(parsed.isEmpty).toBe(true)
    expect(parsed.warnings).toEqual([])
  })
})

describe('passcodes et codes d’impression', () => {
  it('reconnaît un nombre à 8 chiffres et la forme #', () => {
    expect(parseQuery('12345678 #42 id:7').query.ids).toEqual([12345678, 42, 7])
  })

  it('un nombre court sans # reste un mot', () => {
    expect(parseQuery('39').query.words).toEqual(['39'])
  })

  it('convertit un code complet en clé sans région', () => {
    const { query, chips } = parseQuery('LOB-FR001 tst-005 code:abc-de010')
    expect(query.codes).toEqual(['LOB-001', 'TST-005', 'ABC-010'])
    expect(query.regions).toEqual(['FR', 'DE'])
    expect(chips[0]?.label).toBe('Code LOB-FR001')
  })

  it('un code partiel devient un filtre d’extension', () => {
    expect(parseQuery('set:LOB').query.filters).toEqual([
      { field: 'set', negate: false, values: [{ value: 'LOB', exact: false, label: 'LOB' }] },
    ])
    const partial = parseQuery('code:lob-fr0')
    expect(partial.query.filters[0]?.field).toBe('set')
    expect(partial.chips[0]?.label).toBe('Code commençant par : LOB-FR0')
  })

  it("refuse l'exclusion d'un passcode avec un avertissement", () => {
    const parsed = parseQuery('-12345678')
    expect(parsed.query.ids).toEqual([])
    expect(parsed.warnings[0]).toMatch(/exclusion/)
  })
})

describe('filtres numériques', () => {
  it.each([
    ['atk>=2500', 'atk', { min: 2500 }],
    ['att>2500', 'atk', { min: 2501 }],
    ['def<1000', 'def', { max: 999 }],
    ['DEF<=1000', 'def', { max: 1000 }],
    ['niv:4', 'level', { min: 4, max: 4 }],
    ['niveau:4-8', 'level', { min: 4, max: 8 }],
    ['rang:8..4', 'level', { min: 4, max: 8 }],
    ['rank=3', 'level', { min: 3, max: 3 }],
    ['level:7+', 'level', { min: 7 }],
    ['lien:2', 'link', { min: 2, max: 2 }],
    ['échelle:>=5', 'scale', { min: 5 }],
    ['scale<4', 'scale', { max: 3 }],
  ])('%s', (input, field, range) => {
    expect(parseQuery(input).query.ranges).toEqual({ [field]: range })
  })

  it('combine plusieurs bornes du même champ', () => {
    expect(parseQuery('atk>=1000 atk<=2000 atk>=1500').query.ranges).toEqual({
      atk: { min: 1500, max: 2000 },
    })
  })

  it('ignore les valeurs non numériques avec un avertissement', () => {
    const parsed = parseQuery('atk:? def:abc dragon')
    expect(parsed.query.ranges).toEqual({})
    expect(parsed.warnings).toHaveLength(2)
    expect(parsed.warnings[0]).toMatch(/ATK/)
    expect(parsed.query.words).toEqual(['dragon'])
  })

  it('refuse != et l’exclusion des nombres', () => {
    const parsed = parseQuery('atk!=1000 -def:500')
    expect(parsed.isEmpty).toBe(true)
    expect(parsed.warnings).toHaveLength(2)
  })

  it('produit des puces lisibles', () => {
    expect(parseQuery('atk>=2500 def<=1000 niv:4-8 lien:3').chips.map((c) => c.label)).toEqual([
      'ATK ≥ 2500',
      'DEF ≤ 1000',
      'Niveau/Rang de 4 à 8',
      'Lien = 3',
    ])
  })
})

describe('filtres texte et listes', () => {
  it.each([
    ['type:magie', 'Spell'],
    ['type:Spell', 'Spell'],
    ['type:piège', 'Trap'],
    ['type:xyz', 'XYZ'],
    ['type:effet', 'Effect'],
    ['type:syntoniseur', 'Tuner'],
    ['genre:Pendule', 'Pendulum'],
    ['type:lien', 'Link'],
  ])('%s → %s', (input, value) => {
    expect(parseQuery(input).query.filters[0]?.values).toEqual([
      expect.objectContaining({ value, exact: true }),
    ])
  })

  it('un type inconnu devient une recherche approchée', () => {
    expect(parseQuery('type:"monstre bizarre"').query.filters[0]?.values).toEqual([
      { value: 'monstre bizarre', exact: false, label: 'monstre bizarre' },
    ])
  })

  it.each([
    ['attr:lumière', 'LIGHT'],
    ['attribut:TENEBRES', 'DARK'],
    ['attribute:water', 'WATER'],
    ['attr:feu', 'FIRE'],
    ['attr:terre', 'EARTH'],
    ['attr:vent', 'WIND'],
    ['attr:divin', 'DIVINE'],
  ])('%s → %s', (input, value) => {
    expect(parseQuery(input).query.filters[0]?.values[0]?.value).toBe(value)
  })

  it('un attribut inconnu est signalé', () => {
    const parsed = parseQuery('attr:violet')
    expect(parsed.query.filters).toEqual([])
    expect(parsed.warnings[0]).toMatch(/Attribut inconnu/)
  })

  it.each([
    ['race:guerrier', 'Warrior'],
    ['espece:Magicien', 'Spellcaster'],
    ['espèce:"bête ailée"', 'Winged Beast'],
    ['race:bete-guerrier', 'Beast-Warrior'],
    ['race:démon', 'Fiend'],
    ['race:serpent-de-mer', 'Sea Serpent'],
    ['race:jeu-rapide', 'Quick-Play'],
    ['race:continue', 'Continuous'],
    ['race:terrain', 'Field'],
    ['race:équipement', 'Equip'],
    ['race:rituel', 'Ritual'],
    ['race:contre-attaque', 'Counter'],
    ['race:Quick-Play', 'Quick-Play'],
  ])('%s → %s', (input, value) => {
    expect(parseQuery(input).query.filters[0]?.values[0]).toMatchObject({ value, exact: true })
  })

  it('accepte plusieurs valeurs séparées par des virgules', () => {
    const [filter] = parseQuery('attr:feu,eau').query.filters
    expect(filter?.values.map((v) => v.value)).toEqual(['FIRE', 'WATER'])
    expect(parseQuery('attr:feu,eau').chips[0]?.label).toBe('Attribut : Feu ou Eau')
  })

  it('flèches Lien en français', () => {
    const parsed = parseQuery('fleche:haut,bas-gauche marker:right')
    expect(parsed.query.filters.map((f) => f.values.map((v) => v.value))).toEqual([
      ['Top', 'Bottom-Left'],
      ['Right'],
    ])
    expect(parsed.chips[0]?.label).toBe('Flèches Lien : Haut et Bas-gauche')
    expect(parseQuery('flèche:nord').warnings[0]).toMatch(/Flèche inconnue/)
  })

  it('archétype, texte, nom, nom anglais, extension, rareté', () => {
    const { query } = parseQuery(
      'arch:"Héros Fictif" texte:"piocher 2" nom:golem en:Golem set:TST rareté:secrète',
    )
    expect(query.filters).toEqual([
      {
        field: 'arch',
        negate: false,
        values: [{ value: 'heros fictif', exact: false, label: 'Héros Fictif' }],
      },
      {
        field: 'text',
        negate: false,
        values: [{ value: 'piocher 2', exact: false, label: 'piocher 2' }],
      },
      { field: 'name', negate: false, values: [{ value: 'golem', exact: false, label: 'golem' }] },
      { field: 'en', negate: false, values: [{ value: 'golem', exact: false, label: 'Golem' }] },
      { field: 'set', negate: false, values: [{ value: 'TST', exact: false, label: 'TST' }] },
      {
        field: 'rarity',
        negate: false,
        values: [{ value: 'secret', exact: false, label: 'secrète' }],
      },
    ])
    expect(query.words).toEqual([])
  })

  it('accepte anglais: et desc:', () => {
    expect(parseQuery('anglais:dragon').query.filters[0]?.field).toBe('en')
    expect(parseQuery('desc:pioche').query.filters[0]?.field).toBe('text')
  })

  it('exclusion d’un filtre', () => {
    const parsed = parseQuery('-type:effet')
    expect(parsed.query.filters[0]?.negate).toBe(true)
    expect(parsed.chips[0]?.label).toBe('Sans Type : Effet')
  })

  it('valeur manquante', () => {
    expect(parseQuery('type:').warnings[0]).toMatch(/Valeur manquante/)
  })

  it('un opérateur de comparaison sur un champ texte est signalé', () => {
    expect(parseQuery('type>magie').warnings[0]).toMatch(/nombre/)
  })
})

describe('collection', () => {
  it.each(['in:collection', 'dans:possédées', 'possedees', 'Possédées', 'in:col'])(
    '%s',
    (input) => {
      const parsed = parseQuery(input)
      expect(parsed.query.ownedOnly).toBe(true)
      expect(parsed.chips[0]?.label).toBe('Dans ma collection')
    },
  )

  it('in: inconnu', () => {
    expect(parseQuery('in:deck').warnings[0]).toMatch(/in:collection/)
  })
})

describe('saisies inconnues', () => {
  it('un champ inconnu est cherché comme du texte avec un avertissement', () => {
    const parsed = parseQuery('couleur:rouge')
    expect(parsed.query.words).toEqual(['couleur', 'rouge'])
    expect(parsed.warnings).toEqual([
      "« couleur: » n'est pas un filtre connu : cherché comme texte.",
    ])
  })

  it('ne lève jamais d’exception sur des saisies bizarres', () => {
    for (const input of [
      '"',
      '-',
      '::',
      'a:b:c',
      'atk>=',
      '#',
      '-"',
      '""',
      'niv:-',
      '—',
      '\u0000',
    ]) {
      expect(() => parseQuery(input)).not.toThrow()
    }
  })

  it('combinaison complète', () => {
    const parsed = parseQuery('dragon atk>=2000 type:dragon')
    expect(parsed.query.words).toEqual(['dragon'])
    expect(parsed.query.ranges.atk).toEqual({ min: 2000 })
    // « type:dragon » n'est pas un genre de carte : on le cherche aussi comme type de monstre.
    expect(parsed.query.filters[0]?.values[0]).toEqual({
      value: 'dragon',
      exact: false,
      label: 'Dragon',
    })
    expect(parseQuery('type:guerrier').query.filters[0]?.values[0]?.value).toBe('warrior')
    expect(parsed.isEmpty).toBe(false)
  })
})

describe('outils de réécriture', () => {
  it('removeToken retire un jeton', () => {
    expect(removeToken('dragon  atk>=2000 "a b"', 1)).toBe('dragon "a b"')
  })

  it('quoteValue n’ajoute des guillemets que si nécessaire', () => {
    expect(quoteValue('LOB')).toBe('LOB')
    expect(quoteValue('Héros "Fictif" Bleu')).toBe('"Héros Fictif Bleu"')
  })

  it('parseToken garde le texte brut', () => {
    expect(parseToken('-Golem')).toMatchObject({ kind: 'word', raw: '-Golem', negate: true })
  })
})
