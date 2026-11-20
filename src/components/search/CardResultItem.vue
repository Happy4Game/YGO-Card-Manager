<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import type { CardData } from '@/domain/card'
import CardImage from '@/components/common/CardImage.vue'

const props = defineProps<{ card: CardData }>()

/** Caractéristiques affichées seulement quand elles existent (monstres). */
const stats = computed(() => {
  const { card } = props
  const list: { label: string; value: string }[] = []
  if (card.level !== undefined) {
    list.push({ label: card.type.includes('XYZ') ? 'Rang' : 'Niveau', value: String(card.level) })
  }
  if (card.linkval !== undefined) list.push({ label: 'LINK', value: String(card.linkval) })
  if (card.scale !== undefined) list.push({ label: 'Échelle', value: String(card.scale) })
  if (card.atk !== undefined) list.push({ label: 'ATK', value: String(card.atk) })
  if (card.def !== undefined) list.push({ label: 'DEF', value: String(card.def) })
  return list
})

const subtitle = computed(() =>
  [props.card.type, props.card.race, props.card.attribute].filter(Boolean).join(' · '),
)
</script>

<template>
  <article class="card" :aria-labelledby="`card-${card.id}-name`">
    <CardImage :card-id="card.id" class="thumb" />
    <h3 :id="`card-${card.id}-name`">{{ card.name }}</h3>
    <p class="subtitle">{{ subtitle }}</p>
    <dl v-if="stats.length > 0" class="stats">
      <div v-for="stat in stats" :key="stat.label">
        <dt>{{ stat.label }}</dt>
        <dd>{{ stat.value }}</dd>
      </div>
    </dl>
    <!-- <details> se replie et se déplie au clavier sans JavaScript.
         Doc MDN : https://developer.mozilla.org/fr/docs/Web/HTML/Element/details -->
    <details v-if="card.desc">
      <summary>Texte de la carte</summary>
      <!-- Interpolation {{ }} : Vue échappe le HTML, jamais de v-html sur un texte de l'API. -->
      <p class="desc">{{ card.desc }}</p>
    </details>
    <RouterLink class="add" :to="{ name: 'collection', query: { add: String(card.id) } }">
      Ajouter à ma collection<span class="visually-hidden"> : {{ card.name }}</span>
    </RouterLink>
  </article>
</template>

<style scoped>
.thumb {
  float: right;
  margin: 0 0 0.5rem 0.75rem;
}
.card {
  overflow: hidden;
  border: 1px solid #888;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
h3 {
  margin: 0;
}
.subtitle {
  margin: 0.25rem 0;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 1rem;
  margin: 0.25rem 0;
}
.stats div {
  display: flex;
  gap: 0.25rem;
}
dt {
  font-weight: bold;
}
dd {
  margin: 0;
}
.desc {
  white-space: pre-line;
}
.add {
  display: inline-block;
  margin-top: 0.5rem;
}
summary:focus-visible,
.add:focus-visible {
  outline: 3px solid currentColor;
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
