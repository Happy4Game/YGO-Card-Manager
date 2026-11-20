<script setup lang="ts">
import { computed, ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'

/**
 * Miniature d'une carte, chargée depuis le serveur d'images YGOPRODeck.
 * Le service worker la met en cache au premier affichage : elle n'est téléchargée qu'une fois
 * par appareil, et rien n'est hébergé par ce projet.
 */
const props = defineProps<{ cardId: number }>()
const settings = useSettingsStore()
const failed = ref(false)

const src = computed(
  () => `https://images.ygoprodeck.com/images/cards_small/${String(props.cardId)}.jpg`,
)
</script>

<template>
  <!-- alt="" : l'image est décorative, le nom de la carte est déjà écrit à côté.
       Doc W3C : https://www.w3.org/WAI/tutorials/images/decorative/ -->
  <img
    v-if="settings.showImages && !failed"
    class="card-image"
    :src="src"
    alt=""
    width="84"
    height="123"
    loading="lazy"
    decoding="async"
    referrerpolicy="no-referrer"
    @error="failed = true"
  />
</template>

<style scoped>
.card-image {
  flex: none;
  border-radius: 0.25rem;
  background: #ddd;
}
</style>
