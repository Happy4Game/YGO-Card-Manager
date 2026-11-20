<script setup lang="ts">
/**
 * Aide de la syntaxe du champ universel. Chaque exemple est un bouton qui le lance.
 */
defineProps<{ headingId: string }>()
const emit = defineEmits<{ example: [query: string]; close: [] }>()

const rows: { syntax: string; meaning: string; example: string }[] = [
  {
    syntax: 'mots',
    meaning: 'Nom français ou anglais (tous les mots), puis texte',
    example: 'dragon blanc',
  },
  { syntax: '"expression"', meaning: 'Expression exacte', example: '"piochez 2 cartes"' },
  { syntax: '-mot', meaning: 'Exclut un mot ou un filtre', example: 'dragon -type:effet' },
  { syntax: '12345678 ou #123', meaning: 'Passcode', example: '#12345678' },
  { syntax: 'LOB-FR001', meaning: "Code d'impression (région facultative)", example: 'lob-001' },
  { syntax: 'set:', meaning: 'Extension (préfixe du code ou nom)', example: 'set:LOB' },
  { syntax: 'atk / def', meaning: 'Comparaisons : >=, <=, >, <, :', example: 'atk>=2500 def<1000' },
  { syntax: 'niv / rang', meaning: 'Niveau ou Rang, valeur ou intervalle', example: 'niv:4-8' },
  {
    syntax: 'lien / echelle',
    meaning: 'Classe Lien, échelle Pendule',
    example: 'lien:3 echelle>=5',
  },
  {
    syntax: 'type:',
    meaning: 'Magie, Piège, Effet, XYZ, Synchro, Pendule, Syntoniseur…',
    example: 'type:xyz',
  },
  {
    syntax: 'attr:',
    meaning: 'Lumière, Ténèbres, Eau, Feu, Terre, Vent, Divin',
    example: 'attr:ténèbres',
  },
  {
    syntax: 'race:',
    meaning: 'Type de monstre ou sous-type (Jeu-Rapide, Continue…)',
    example: 'race:magicien',
  },
  { syntax: 'arch:', meaning: 'Archétype', example: 'arch:"héros"' },
  { syntax: 'texte:', meaning: 'Uniquement dans le texte de la carte', example: 'texte:détruisez' },
  { syntax: 'en:', meaning: 'Uniquement dans le nom anglais', example: 'en:dragon' },
  {
    syntax: 'fleche:',
    meaning: 'Flèches Lien (haut, bas-gauche…), toutes exigées',
    example: 'fleche:haut,bas',
  },
  { syntax: 'rarete:', meaning: 'Rareté d’une impression', example: 'rarete:secrete' },
  {
    syntax: 'in:collection',
    meaning: 'Seulement les cartes que je possède',
    example: 'in:collection',
  },
]
</script>

<template>
  <div class="help">
    <div class="help-head">
      <h2 :id="headingId" tabindex="-1">Comment chercher ?</h2>
      <button type="button" class="close" @click="emit('close')">
        <span aria-hidden="true">×</span><span class="visually-hidden">Fermer l'aide</span>
      </button>
    </div>
    <p class="lead">
      Tape n'importe quoi : un nom, un code imprimé sur la carte, un passcode ou des filtres.
      Combine-les librement, accents et majuscules sont ignorés. Les virgules donnent un « ou » :
      <code>attr:feu,eau</code>.
    </p>
    <table>
      <caption class="visually-hidden">
        Syntaxe de la recherche
      </caption>
      <thead>
        <tr>
          <th scope="col">Syntaxe</th>
          <th scope="col">Effet</th>
          <th scope="col">Exemple</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.syntax">
          <th scope="row">
            <code>{{ row.syntax }}</code>
          </th>
          <td>{{ row.meaning }}</td>
          <td>
            <button type="button" class="example" @click="emit('example', row.example)">
              <span class="visually-hidden">Essayer </span><code>{{ row.example }}</code>
            </button>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="lead">
      Alias acceptés : <code>att</code>, <code>niveau</code>, <code>rank</code>, <code>link</code>,
      <code>scale</code>, <code>attribut</code>, <code>espece</code>, <code>archetype</code>,
      <code>desc</code>, <code>anglais</code>, <code>marker</code>, <code>possedees</code>…
    </p>
  </div>
</template>

<style scoped>
.help {
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-md);
}
.help-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}
h2 {
  margin: 0;
  font-size: var(--text-lg);
}
h2:focus {
  outline: none;
}
.lead {
  margin: var(--space-2) 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
  line-height: 1.5;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--text-sm);
}
th,
td {
  padding: var(--space-2) var(--space-1);
  border-top: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}
thead th {
  border-top: none;
  color: var(--color-text-muted);
  font-weight: 600;
}
code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  overflow-wrap: anywhere;
}
.example {
  padding: var(--space-1) var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
  color: var(--color-primary);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.close {
  display: grid;
  place-items: center;
  width: 2.5rem;
  height: 2.5rem;
  border: none;
  border-radius: 50%;
  background: var(--color-surface-2);
  color: var(--color-text);
  font-size: var(--text-lg);
  cursor: pointer;
}
.example:focus-visible,
.close:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
@media (max-width: 30rem) {
  /* Sur téléphone, la colonne « Effet » passe sous la syntaxe pour éviter le défilement horizontal. */
  thead {
    display: none;
  }
  tr {
    display: grid;
    grid-template-columns: 1fr auto;
    border-top: 1px solid var(--color-border);
    padding-block: var(--space-1);
  }
  th,
  td {
    border: none;
    padding: var(--space-1);
  }
  td:first-of-type {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
