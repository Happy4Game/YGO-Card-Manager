<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import CardImage from '@/components/common/CardImage.vue'
import QuickAddButton from '@/components/common/QuickAddButton.vue'
import type { CardData } from '@/domain/card'
import { setCodeKey } from '@/domain/setCode'
import { routes } from '@/lib/routes'
import { matchingSet, preferredSetCodes } from '@/services/scan/lookup'
import { normalizeManualCode } from '@/services/scan/ocrText'
import type { SheetContent } from './types'

/**
 * Feuille de résultat (en bas de l'écran) : la carte reconnue et l'ajout à la collection,
 * ou un choix quand plusieurs cartes correspondent (code partagé, lecture du nom).
 */
const props = defineProps<{ content: SheetContent }>()
const emit = defineEmits<{
  /** Fermer la feuille et reprendre le scan. */
  resume: []
  /** Chercher un autre code (saisi ou corrigé). */
  lookup: [code: string]
  /** Une carte a été choisie dans une liste. */
  pick: [card: CardData, code: string]
}>()

const heading = useTemplateRef<HTMLHeadingElement>('heading')
const editedCode = ref('')

const single = computed(() =>
  props.content.kind === 'code' && props.content.cards.length === 1
    ? props.content.cards[0]
    : undefined,
)

watch(
  () => props.content,
  async (content) => {
    editedCode.value = content.kind === 'code' ? content.code : ''
    // Le focus va sur le titre : un lecteur d'écran annonce le résultat, Tab mène aux actions.
    await nextTick()
    heading.value?.focus()
  },
  { immediate: true },
)

const normalizedCode = computed(() => normalizeManualCode(editedCode.value))
/** Le code corrigé appartient-il toujours à la carte affichée ? */
const codeBelongsToCard = computed(() => {
  const card = single.value
  const key = normalizedCode.value ? setCodeKey(normalizedCode.value) : undefined
  return card !== undefined && key !== undefined && card.setKeys.includes(key)
})
const print = computed(() =>
  single.value && normalizedCode.value && codeBelongsToCard.value
    ? matchingSet(single.value, normalizedCode.value)
    : undefined,
)
const addLink = computed(() =>
  single.value
    ? routes.collectionAdd(
        single.value.id,
        codeBelongsToCard.value ? normalizedCode.value : undefined,
      )
    : undefined,
)
const datalistId = computed(() => `scan-codes-${String(single.value?.id ?? 0)}`)

function submitCode() {
  const code = normalizedCode.value
  if (code && !codeBelongsToCard.value) emit('lookup', code)
}

function pickCode(card: CardData): string {
  if (props.content.kind === 'code') {
    const key = setCodeKey(props.content.code)
    return card.sets.find((set) => setCodeKey(set.code) === key)?.code ?? props.content.code
  }
  return preferredSetCodes(card)[0] ?? ''
}

const title = computed(() => {
  if (single.value) return single.value.name
  if (props.content.kind === 'names') {
    return props.content.cards.length > 0 ? 'Est-ce une de ces cartes ?' : 'Nom non reconnu'
  }
  return props.content.cards.length > 0 ? 'Plusieurs cartes possibles' : 'Carte introuvable'
})
</script>

<template>
  <section class="sheet" aria-labelledby="scan-sheet-title">
    <div class="grip" aria-hidden="true"></div>
    <h2 id="scan-sheet-title" ref="heading" class="title" tabindex="-1">{{ title }}</h2>

    <!-- Une seule carte : détail et ajout -->
    <div v-if="single" class="detail">
      <div class="thumb">
        <CardImage :card-id="single.id" />
      </div>
      <div class="info">
        <p class="type">{{ single.typeLabel ?? single.type }}</p>
        <form class="code-form" @submit.prevent="submitCode">
          <label class="code-label" for="scan-sheet-code">Code d'impression lu</label>
          <div class="code-row">
            <input
              id="scan-sheet-code"
              v-model="editedCode"
              class="code-input"
              type="text"
              inputmode="text"
              autocomplete="off"
              autocapitalize="characters"
              spellcheck="false"
              :list="datalistId"
            />
            <datalist :id="datalistId">
              <option v-for="code in preferredSetCodes(single)" :key="code" :value="code" />
            </datalist>
            <button v-if="!codeBelongsToCard && normalizedCode" class="btn btn-ghost" type="submit">
              Chercher ce code
            </button>
          </div>
        </form>
        <p v-if="print" class="print">
          <span>{{ print.name }}</span>
          <span v-if="print.rarity" class="rarity">{{ print.rarity }}</span>
        </p>
        <p v-else-if="editedCode && !codeBelongsToCard" class="warning">
          Ce code ne correspond pas à cette carte.
        </p>
      </div>
    </div>

    <!-- Plusieurs cartes, ou suggestions par nom -->
    <template v-else>
      <p v-if="content.kind === 'code' && content.cards.length > 1" class="lead">
        Le code <strong class="mono">{{ content.code }}</strong> correspond à plusieurs cartes.
        Choisis la bonne :
      </p>
      <p v-else-if="content.kind === 'code'" class="lead">
        Aucune carte connue pour le code <strong class="mono">{{ content.code }}</strong
        >. Vérifie le code ou cherche la carte par son nom.
      </p>
      <p v-else-if="content.cards.length > 0" class="lead">
        Nom lu : « {{ content.query.trim() || '…' }} »
      </p>
      <p v-else class="lead">
        Aucun nom proche de « {{ content.query.trim() || '…' }} ». Rapproche la carte, ou saisis le
        code.
      </p>

      <ul v-if="content.cards.length > 0" class="choices">
        <li v-for="card in content.cards" :key="card.id">
          <button class="choice" type="button" @click="emit('pick', card, pickCode(card))">
            <CardImage :card-id="card.id" />
            <span class="choice-text">
              <span class="choice-name">{{ card.name }}</span>
              <span class="choice-type">{{ card.typeLabel ?? card.type }}</span>
            </span>
          </button>
        </li>
      </ul>

      <form v-if="content.kind === 'code'" class="code-form" @submit.prevent="submitCode">
        <label class="code-label" for="scan-sheet-code-fix">Corriger le code</label>
        <div class="code-row">
          <input
            id="scan-sheet-code-fix"
            v-model="editedCode"
            class="code-input"
            type="text"
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
          />
          <button class="btn btn-ghost" type="submit">Chercher</button>
        </div>
      </form>
      <a class="text-link" :href="routes.search()">Chercher la carte par son nom</a>
    </template>

    <div class="actions">
      <!-- Ajout en un geste (derniers réglages utilisés) ; « Détails » ouvre le formulaire complet. -->
      <QuickAddButton
        v-if="single"
        :key="`${single.id}-${normalizedCode}`"
        :card="single"
        :set-code="codeBelongsToCard ? normalizedCode : undefined"
      />
      <button
        class="btn"
        :class="addLink ? 'btn-ghost' : 'btn-primary'"
        type="button"
        @click="emit('resume')"
      >
        Scanner une autre carte
      </button>
    </div>
  </section>
</template>

<style scoped>
.sheet {
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 82vh;
  overflow-y: auto;
  margin-inline: auto;
  max-width: 40rem;
  padding: var(--space-2) var(--space-4) calc(var(--space-4) + env(safe-area-inset-bottom));
  border: 1px solid var(--color-border);
  border-bottom: 0;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow-md);
  animation: rise 220ms ease-out;
}
@keyframes rise {
  from {
    transform: translateY(40%);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .sheet {
    animation: none;
  }
}

.grip {
  width: 2.5rem;
  height: 0.3rem;
  margin: 0 auto var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--color-border);
}

.title {
  margin: 0 0 var(--space-3);
  font-size: var(--text-lg);
  line-height: 1.25;
}
.title:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.detail {
  display: flex;
  gap: var(--space-4);
  align-items: flex-start;
}
.thumb {
  flex: none;
  width: 84px;
  min-height: 123px;
  border-radius: var(--radius-sm);
  background: var(--color-surface-2);
}
.info {
  flex: 1;
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}
.type {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}
.print {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  align-items: center;
  font-size: var(--text-sm);
}
.rarity {
  padding: 0.1rem var(--space-2);
  border-radius: var(--radius-pill);
  background: var(--color-surface-2);
  color: var(--color-text-muted);
}
.warning {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.code-form {
  display: grid;
  gap: var(--space-1);
  margin-block: var(--space-2);
}
.code-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.code-row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
.code-input {
  flex: 1;
  min-width: 8rem;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: 600 var(--text-md) / 1 var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.code-input:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}

.lead {
  margin: 0 0 var(--space-3);
  color: var(--color-text-muted);
}
.mono {
  font-family: var(--font-mono);
  color: var(--color-text);
}

.choices {
  list-style: none;
  margin: 0 0 var(--space-3);
  padding: 0;
  display: grid;
  gap: var(--space-2);
}
.choice {
  width: 100%;
  min-height: 44px;
  display: flex;
  gap: var(--space-3);
  align-items: center;
  padding: var(--space-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.choice :deep(.card-image) {
  width: 42px;
  height: auto;
}
.choice:hover {
  background: var(--color-surface-2);
}
.choice:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.choice-text {
  display: grid;
}
.choice-name {
  font-weight: 600;
}
.choice-type {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.text-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
}
.text-link:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.actions {
  display: grid;
  gap: var(--space-2);
  margin-top: var(--space-4);
}
@media (min-width: 30rem) {
  .actions {
    grid-auto-flow: column;
    grid-auto-columns: 1fr;
  }
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font: 600 var(--text-md) / 1.2 var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}
.btn:active {
  transform: scale(0.98);
}
.btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.btn-primary {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.btn-ghost {
  background: var(--color-surface-2);
  border-color: var(--color-border);
  color: var(--color-text);
}
</style>
