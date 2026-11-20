/**
 * Vocabulaire du jeu en français et en anglais.
 *
 * L'API YGOPRODeck renvoie les noms et textes traduits, mais garde certains champs en anglais
 * (`type`, `race`, `attribute`, `linkmarkers`) : ces tables permettent de chercher et
 * d'afficher en français tout en comparant avec les valeurs anglaises stockées.
 * Toutes les clés passent par `keyOf` (minuscules, sans accents, espaces → tirets).
 */
import { keyOf } from './normalize'

export interface VocabularyEntry {
  /** Valeur telle que stockée dans les données (anglais). */
  value: string
  /** Libellé français affiché. */
  label: string
  /** Alias acceptés dans la recherche (français, anglais, abréviations). */
  aliases: readonly string[]
}

function buildLookup(entries: readonly VocabularyEntry[]): Map<string, VocabularyEntry> {
  const lookup = new Map<string, VocabularyEntry>()
  for (const entry of entries) {
    for (const alias of [entry.value, entry.label, ...entry.aliases])
      lookup.set(keyOf(alias), entry)
  }
  return lookup
}

// --- Attributs ---------------------------------------------------------------

export const ATTRIBUTES: readonly VocabularyEntry[] = [
  { value: 'LIGHT', label: 'Lumière', aliases: ['light', 'lumiere'] },
  { value: 'DARK', label: 'Ténèbres', aliases: ['dark', 'tenebres', 'tenebre'] },
  { value: 'WATER', label: 'Eau', aliases: ['water'] },
  { value: 'FIRE', label: 'Feu', aliases: ['fire'] },
  { value: 'EARTH', label: 'Terre', aliases: ['earth'] },
  { value: 'WIND', label: 'Vent', aliases: ['wind'] },
  { value: 'DIVINE', label: 'Divin', aliases: ['divine', 'divin'] },
]

// --- Types de monstres et sous-types de Magie/Piège (champ `race`) -----------

export const MONSTER_RACES: readonly VocabularyEntry[] = [
  { value: 'Aqua', label: 'Aqua', aliases: [] },
  { value: 'Beast', label: 'Bête', aliases: ['bete'] },
  { value: 'Beast-Warrior', label: 'Bête-Guerrier', aliases: ['bete-guerrier', 'bete-guerriere'] },
  { value: 'Creator-God', label: 'Dieu Créateur', aliases: ['dieu-createur', 'creator-god'] },
  { value: 'Cyberse', label: 'Cyberse', aliases: [] },
  { value: 'Dinosaur', label: 'Dinosaure', aliases: ['dinosaure', 'dino'] },
  { value: 'Divine-Beast', label: 'Bête Divine', aliases: ['bete-divine'] },
  { value: 'Dragon', label: 'Dragon', aliases: [] },
  { value: 'Fairy', label: 'Elfe', aliases: ['elfe', 'fee'] },
  { value: 'Fiend', label: 'Démon', aliases: ['demon'] },
  { value: 'Fish', label: 'Poisson', aliases: ['poisson'] },
  { value: 'Illusion', label: 'Illusion', aliases: [] },
  { value: 'Insect', label: 'Insecte', aliases: ['insecte'] },
  { value: 'Machine', label: 'Machine', aliases: [] },
  { value: 'Plant', label: 'Plante', aliases: ['plante'] },
  { value: 'Psychic', label: 'Psychique', aliases: ['psychique', 'psy'] },
  { value: 'Pyro', label: 'Pyro', aliases: [] },
  { value: 'Reptile', label: 'Reptile', aliases: [] },
  { value: 'Rock', label: 'Rocher', aliases: ['rocher', 'roche'] },
  { value: 'Sea Serpent', label: 'Serpent de Mer', aliases: ['serpent-de-mer', 'sea-serpent'] },
  { value: 'Spellcaster', label: 'Magicien', aliases: ['magicien', 'mage'] },
  { value: 'Thunder', label: 'Tonnerre', aliases: ['tonnerre'] },
  { value: 'Warrior', label: 'Guerrier', aliases: ['guerrier'] },
  { value: 'Winged Beast', label: 'Bête Ailée', aliases: ['bete-ailee', 'winged-beast'] },
  { value: 'Wyrm', label: 'Wyrm', aliases: [] },
  { value: 'Zombie', label: 'Zombie', aliases: [] },
]

export const SPELL_TRAP_RACES: readonly VocabularyEntry[] = [
  { value: 'Normal', label: 'Normal', aliases: ['normale'] },
  { value: 'Continuous', label: 'Continue', aliases: ['continue', 'continu', 'permanente'] },
  { value: 'Quick-Play', label: 'Jeu-Rapide', aliases: ['jeu-rapide', 'rapide', 'quick'] },
  { value: 'Field', label: 'Terrain', aliases: ['terrain'] },
  { value: 'Equip', label: 'Équipement', aliases: ['equipement'] },
  { value: 'Ritual', label: 'Rituel', aliases: ['rituel', 'rituelle'] },
  { value: 'Counter', label: 'Contre-Attaque', aliases: ['contre-attaque', 'contre'] },
]

export const RACES: readonly VocabularyEntry[] = [...MONSTER_RACES, ...SPELL_TRAP_RACES]

// --- Genres de carte (mots du champ `type`, ex. « Synchro Tuner Monster ») -----

export const CARD_KINDS: readonly VocabularyEntry[] = [
  { value: 'Monster', label: 'Monstre', aliases: ['monstre', 'monstres', 'monster'] },
  { value: 'Spell', label: 'Magie', aliases: ['magie', 'magic', 'sort'] },
  { value: 'Trap', label: 'Piège', aliases: ['piege'] },
  { value: 'Effect', label: 'Effet', aliases: ['effet'] },
  { value: 'Normal', label: 'Normal', aliases: ['normaux'] },
  { value: 'Fusion', label: 'Fusion', aliases: [] },
  { value: 'Synchro', label: 'Synchro', aliases: [] },
  { value: 'XYZ', label: 'XYZ', aliases: ['xyz'] },
  { value: 'Link', label: 'Lien', aliases: ['lien'] },
  { value: 'Ritual', label: 'Rituel', aliases: ['rituel'] },
  { value: 'Pendulum', label: 'Pendule', aliases: ['pendule'] },
  { value: 'Tuner', label: 'Syntoniseur', aliases: ['syntoniseur', 'synto'] },
  { value: 'Flip', label: 'Flip', aliases: ['retournement'] },
  { value: 'Toon', label: 'Toon', aliases: [] },
  { value: 'Spirit', label: 'Spirit', aliases: ['esprit'] },
  { value: 'Union', label: 'Union', aliases: [] },
  { value: 'Gemini', label: 'Gémeau', aliases: ['gemeau', 'gemeaux'] },
  { value: 'Token', label: 'Jeton', aliases: ['jeton'] },
  { value: 'Skill', label: 'Compétence', aliases: ['competence'] },
]

/** Grandes catégories, proposées à part dans le formulaire avancé. */
export const CARD_CATEGORIES = ['Monster', 'Spell', 'Trap'] as const

// --- Flèches Lien --------------------------------------------------------------

/** Ordre de lecture de la grille 3×3 (case centrale vide). */
export const LINK_MARKERS: readonly VocabularyEntry[] = [
  { value: 'Top-Left', label: 'Haut-gauche', aliases: ['haut-gauche', 'hg', 'top-left'] },
  { value: 'Top', label: 'Haut', aliases: ['haut', 'h', 'top'] },
  { value: 'Top-Right', label: 'Haut-droite', aliases: ['haut-droite', 'hd', 'top-right'] },
  { value: 'Left', label: 'Gauche', aliases: ['gauche', 'g', 'left'] },
  { value: 'Right', label: 'Droite', aliases: ['droite', 'd', 'right'] },
  { value: 'Bottom-Left', label: 'Bas-gauche', aliases: ['bas-gauche', 'bg', 'bottom-left'] },
  { value: 'Bottom', label: 'Bas', aliases: ['bas', 'b', 'bottom'] },
  { value: 'Bottom-Right', label: 'Bas-droite', aliases: ['bas-droite', 'bd', 'bottom-right'] },
]

// --- Raretés (stockées en anglais par l'API) ----------------------------------

/** Mots français de rareté → mot anglais correspondant dans les données. */
export const RARITY_WORDS: Readonly<Record<string, string>> = {
  commune: 'common',
  courante: 'common',
  secrete: 'secret',
  fantome: 'ghost',
  ultime: 'ultimate',
  parallele: 'parallel',
  dore: 'gold',
  doree: 'gold',
  platine: 'platinum',
  prismatique: 'prismatic',
}

const ATTRIBUTE_LOOKUP = buildLookup(ATTRIBUTES)
const RACE_LOOKUP = buildLookup(RACES)
const KIND_LOOKUP = buildLookup(CARD_KINDS)
const MARKER_LOOKUP = buildLookup(LINK_MARKERS)

export const findAttribute = (text: string) => ATTRIBUTE_LOOKUP.get(keyOf(text))
export const findRace = (text: string) => RACE_LOOKUP.get(keyOf(text))
export const findKind = (text: string) => KIND_LOOKUP.get(keyOf(text))
export const findMarker = (text: string) => MARKER_LOOKUP.get(keyOf(text))

/** Libellé français d'une valeur anglaise, ou la valeur elle-même si elle est inconnue. */
export function attributeLabel(value: string): string {
  return ATTRIBUTE_LOOKUP.get(keyOf(value))?.label ?? value
}
export function raceLabel(value: string): string {
  return RACE_LOOKUP.get(keyOf(value))?.label ?? value
}
export function kindLabel(value: string): string {
  return KIND_LOOKUP.get(keyOf(value))?.label ?? value
}
export function markerLabel(value: string): string {
  return MARKER_LOOKUP.get(keyOf(value))?.label ?? value
}

/** Les mots du type d'une carte (« Synchro Tuner Monster » → Synchro, Tuner, Monster). */
export function kindsOfType(type: string): string[] {
  return type.split(/\s+/).filter((word) => word !== 'Card' && word !== '')
}

/** Traduction d'un type complet, ex. « Effect Monster » → « Monstre Effet ». */
export function frenchTypeLabel(type: string): string {
  const words = kindsOfType(type)
  // En français, la catégorie vient en premier : « Monstre Synchro Syntoniseur ».
  const category = words.find((word) => (CARD_CATEGORIES as readonly string[]).includes(word))
  const others = words.filter((word) => word !== category)
  return [category, ...others]
    .filter((word): word is string => word !== undefined)
    .map(kindLabel)
    .join(' ')
}
