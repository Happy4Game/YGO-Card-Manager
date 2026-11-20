<script setup lang="ts">
import { ref } from 'vue'
import { db } from '@/db/database'
import type { CardData } from '@/domain/card'
import { routes } from '@/lib/routes'
import { quickAdd, undoQuickAdd } from '@/services/quickAdd'

/**
 * Ajout en un seul geste, avec « Annuler » et un lien vers le formulaire complet.
 * Les messages sont annoncés aux lecteurs d'écran via role="status".
 */
const props = defineProps<{ card: CardData; setCode?: string; owned?: number }>()

const owned = ref(props.owned ?? 0)
const lastEntryId = ref<number>()
const busy = ref(false)
const message = ref('')

async function add() {
  if (busy.value) return
  busy.value = true
  try {
    lastEntryId.value = await quickAdd(db, props.card, props.setCode)
    owned.value += 1
    message.value = `Ajoutée · ${String(owned.value)} possédée${owned.value > 1 ? 's' : ''}`
    navigator.vibrate?.(30)
  } catch {
    message.value = "Échec de l'ajout, réessaie."
  } finally {
    busy.value = false
  }
}

async function undo() {
  if (lastEntryId.value === undefined) return
  await undoQuickAdd(db, lastEntryId.value)
  owned.value = Math.max(0, owned.value - 1)
  lastEntryId.value = undefined
  message.value = 'Ajout annulé.'
}
</script>

<template>
  <div class="quick-add">
    <button type="button" class="quick-add__btn" :disabled="busy" @click="add">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          d="M12 5v14M5 12h14"
          stroke="currentColor"
          stroke-width="2.4"
          stroke-linecap="round"
        />
      </svg>
      {{ owned > 0 ? `${String(owned)}` : 'Ajouter'
      }}<span class="visually-hidden"> un exemplaire de {{ card.name }} à ma collection</span>
    </button>
    <a class="quick-add__more" :href="routes.collectionAdd(card.id, setCode)">
      Détails<span class="visually-hidden"> de l'ajout pour {{ card.name }}</span>
    </a>
    <p class="quick-add__status" role="status">
      <template v-if="message">
        {{ message }}
        <button
          v-if="lastEntryId !== undefined"
          type="button"
          class="quick-add__undo"
          @click="undo"
        >
          Annuler
        </button>
      </template>
    </p>
  </div>
</template>

<style scoped>
.quick-add {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}
.quick-add__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-height: 2.75rem;
  min-width: 2.75rem;
  padding: 0 var(--space-4);
  border: none;
  border-radius: var(--radius-pill);
  background: var(--color-primary);
  color: var(--color-primary-contrast);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  transition: transform var(--transition-fast);
}
.quick-add__btn:active {
  transform: scale(0.96);
}
.quick-add__btn:focus-visible,
.quick-add__undo:focus-visible,
.quick-add__more:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.quick-add__more {
  font-size: var(--text-sm);
  color: var(--color-primary);
}
.quick-add__status {
  flex-basis: 100%;
  margin: 0;
  min-height: 1.25rem;
  font-size: var(--text-sm);
  color: var(--color-success);
  font-weight: 600;
}
.quick-add__undo {
  margin-left: var(--space-2);
  padding: 0;
  border: none;
  background: none;
  color: var(--color-primary);
  font: inherit;
  text-decoration: underline;
  cursor: pointer;
}
</style>
