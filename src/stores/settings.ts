import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const SHOW_IMAGES_KEY = 'settings:showImages'

/** localStorage peut être indisponible (navigation privée, stockage bloqué) : on l'entoure de try/catch. */
function readBoolean(key: string, fallback: boolean): boolean {
  try {
    const value = localStorage.getItem(key)
    return value === null ? fallback : value === 'true'
  } catch {
    return fallback
  }
}

function writeBoolean(key: string, value: boolean): void {
  try {
    localStorage.setItem(key, String(value))
  } catch {
    // Préférence non mémorisée : sans gravité.
  }
}

/** Préférences de l'utilisateur, propres à cet appareil. */
export const useSettingsStore = defineStore('settings', () => {
  const showImages = ref(readBoolean(SHOW_IMAGES_KEY, true))
  watch(showImages, (value) => writeBoolean(SHOW_IMAGES_KEY, value))
  return { showImages }
})
