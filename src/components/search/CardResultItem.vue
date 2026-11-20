<script setup lang="ts">
import { computed } from 'vue'
import CardImage from '@/components/common/CardImage.vue'
import { routes } from '@/lib/routes'
import type { SearchHit } from '@/services/search/searchEngine'
import {
  attributeLabel,
  frenchTypeLabel,
  markerLabel,
  raceLabel,
} from '@/services/search/vocabulary'

const props = defineProps<{ hit: SearchHit }>()

const card = computed(() => props.hit.card)

/** Caractéristiques affichées seulement quand elles existent (monstres). */
const stats = computed(() => {
  const c = card.value
  const list: { label: string; value: string }[] = []
  if (c.level !== undefined) {
    list.push({ label: c.type.includes('XYZ') ? 'Rang' : 'Niveau', value: String(c.level) })
  }
  if (c.linkval !== undefined) list.push({ label: 'Lien', value: String(c.linkval) })
  if (c.scale !== undefined) list.push({ label: 'Échelle', value: String(c.scale) })
  if (c.atk !== undefined) list.push({ label: 'ATK', value: String(c.atk) })
  if (c.def !== undefined) list.push({ label: 'DEF', value: String(c.def) })
  return list
})

const typeText = computed(() => card.value.typeLabel ?? frenchTypeLabel(card.value.type))
const details = computed(() =>
  [card.value.attribute ? attributeLabel(card.value.attribute) : '', raceLabel(card.value.race)]
    .filter(Boolean)
    .join(' · '),
)
const markers = computed(() => (card.value.linkmarkers ?? []).map(markerLabel).join(', '))
const addHref = computed(() => routes.collectionAdd(card.value.id, props.hit.matchedSetCode))
const headingId = computed(() => `card-${card.value.id}-name`)
</script>

<template>
  <article class="card" :aria-labelledby="headingId" tabindex="-1">
    <CardImage :card-id="card.id" class="thumb" />
    <div class="body">
      <header class="head">
        <h3 :id="headingId" class="name">{{ card.name }}</h3>
        <p v-if="card.nameEn" class="name-en" :class="{ matched: hit.matchedEnglish }">
          <span class="visually-hidden">Nom anglais : </span
          ><span lang="en">{{ card.nameEn }}</span>
        </p>
      </header>
      <p class="type">
        {{ typeText }}<template v-if="details"> · {{ details }}</template>
      </p>
      <dl v-if="stats.length > 0" class="stats">
        <div v-for="stat in stats" :key="stat.label" class="stat">
          <dt>{{ stat.label }}</dt>
          <dd>{{ stat.value }}</dd>
        </div>
      </dl>
      <p v-if="markers" class="markers">Flèches : {{ markers }}</p>
      <p class="meta">
        <span class="passcode">#{{ card.id }}</span>
        <span v-if="hit.matchedSetCode" class="set-code">{{ hit.matchedSetCode }}</span>
        <span v-if="hit.ownedQuantity > 0" class="owned">
          {{ hit.ownedQuantity }} possédée{{ hit.ownedQuantity > 1 ? 's' : '' }}
        </span>
      </p>
      <!-- <details> se replie et se déplie au clavier sans JavaScript.
           Doc MDN : https://developer.mozilla.org/fr/docs/Web/HTML/Element/details -->
      <details v-if="card.desc" class="desc-toggle">
        <summary>Texte de la carte</summary>
        <!-- Interpolation {{ }} : Vue échappe le HTML, jamais de v-html sur un texte de l'API. -->
        <p class="desc">{{ card.desc }}</p>
      </details>
    </div>
    <a class="add" :href="addHref">
      Ajouter<span class="visually-hidden"> à ma collection : {{ card.name }}</span>
    </a>
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-areas:
    'thumb body'
    'add add';
  gap: var(--space-2) var(--space-3);
  box-sizing: border-box;
  height: 100%;
  padding: var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
  transition:
    box-shadow var(--transition-fast),
    border-color var(--transition-fast);
}
.card:hover {
  border-color: var(--color-primary);
}
.card:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.thumb {
  grid-area: thumb;
  width: 4rem;
  height: auto;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}
.body {
  grid-area: body;
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  min-width: 0;
}
.head {
  min-width: 0;
}
.name {
  margin: 0;
  font-size: var(--text-md);
  line-height: 1.3;
  overflow-wrap: anywhere;
}
.name-en {
  margin: 0;
  font-size: var(--text-sm);
  font-style: italic;
  color: var(--color-text-muted);
  overflow-wrap: anywhere;
}
.name-en.matched {
  color: var(--color-primary);
}
.type,
.markers {
  margin: 0;
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
  margin: 0;
}
.stat {
  display: flex;
  gap: var(--space-1);
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface-2);
  font-size: var(--text-sm);
}
dt {
  font-weight: 600;
  color: var(--color-text-muted);
}
dd {
  margin: 0;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-2);
  margin: 0;
  font-size: var(--text-sm);
}
.passcode,
.set-code {
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}
.owned {
  padding: 0 var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-success);
  color: var(--color-surface);
  font-weight: 600;
}
.desc-toggle summary {
  width: fit-content;
  cursor: pointer;
  font-size: var(--text-sm);
  color: var(--color-primary);
}
.desc {
  margin: var(--space-2) 0 0;
  font-size: var(--text-sm);
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}
.add {
  grid-area: add;
  justify-self: end;
  display: inline-flex;
  align-items: center;
  min-height: 2.5rem;
  padding: var(--space-1) var(--space-4);
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  font-weight: 600;
  text-decoration: none;
}
.add::before {
  content: '+';
  margin-right: var(--space-1);
  font-size: var(--text-lg);
  line-height: 1;
}
summary:focus-visible,
.add:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
/* Texte lu par les lecteurs d'écran mais masqué visuellement, pour des liens explicites. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
