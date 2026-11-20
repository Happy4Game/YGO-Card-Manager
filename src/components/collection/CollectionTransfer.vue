<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { useCollectionStore } from '@/stores/collection'
import type { ImportMode } from '@/services/collectionTransfer'

const store = useCollectionStore()

/** Un export de collection personnelle dépasse rarement quelques centaines de Ko. */
const MAX_FILE_SIZE = 10 * 1024 * 1024

const fileInput = useTemplateRef<HTMLInputElement>('fileInput')
const mode = ref<ImportMode>('merge')
const confirmReplace = ref(false)
const busy = ref(false)
const message = ref('')
const errors = ref<string[]>([])

function report(text: string, details: string[] = []) {
  message.value = text
  errors.value = details
}

async function runExport(kind: 'json' | 'csv') {
  busy.value = true
  try {
    await (kind === 'json' ? store.exportJson() : store.exportCsv())
    report(`Export ${kind.toUpperCase()} prêt : vérifie tes téléchargements.`)
  } catch (cause) {
    report(`L'export a échoué : ${cause instanceof Error ? cause.message : String(cause)}`)
  } finally {
    busy.value = false
  }
}

async function runImport() {
  const file = fileInput.value?.files?.[0]
  if (!file) {
    report('Choisis d’abord un fichier JSON à importer.')
    return
  }
  if (file.size > MAX_FILE_SIZE) {
    report('Ce fichier est trop volumineux (10 Mo maximum).')
    return
  }
  if (mode.value === 'replace' && !confirmReplace.value) {
    report('Coche la case de confirmation pour remplacer toute la collection.')
    return
  }

  busy.value = true
  try {
    // `File.text()` lit le fichier localement, rien n'est envoyé sur le réseau.
    // Doc : https://developer.mozilla.org/fr/docs/Web/API/Blob/text
    const result = await store.importJson(await file.text(), mode.value)
    if (result.ok) {
      const verb = result.mode === 'replace' ? 'remplacée par' : 'complétée avec'
      report(`Import réussi : collection ${verb} ${result.count} entrée(s).`)
      confirmReplace.value = false
      if (fileInput.value) fileInput.value.value = ''
    } else {
      report('Import annulé, le fichier contient des erreurs :', result.errors)
    }
  } catch (cause) {
    report(`L'import a échoué : ${cause instanceof Error ? cause.message : String(cause)}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <section class="transfer surface" aria-labelledby="transfer-title">
    <div class="transfer__intro">
      <h2 id="transfer-title">Sauvegarde</h2>
      <p class="muted">
        Ta collection n'existe que sur cet appareil : exporte-la régulièrement pour ne pas la
        perdre.
      </p>
    </div>

    <div class="actions">
      <button type="button" class="btn--secondary" :disabled="busy" @click="runExport('json')">
        Exporter en JSON
      </button>
      <button type="button" class="btn--secondary" :disabled="busy" @click="runExport('csv')">
        Exporter en CSV
      </button>
    </div>

    <form class="import" @submit.prevent="runImport">
      <div class="field">
        <label for="import-file">Fichier JSON à importer</label>
        <input id="import-file" ref="fileInput" type="file" accept="application/json,.json" />
      </div>

      <fieldset>
        <legend>Mode d'import</legend>
        <label class="check">
          <input v-model="mode" type="radio" name="import-mode" value="merge" />
          Fusionner avec ma collection
        </label>
        <label class="check">
          <input v-model="mode" type="radio" name="import-mode" value="replace" />
          Remplacer toute ma collection
        </label>
      </fieldset>

      <label v-if="mode === 'replace'" class="check confirm">
        <input v-model="confirmReplace" type="checkbox" />
        Je confirme vouloir effacer ma collection actuelle et la remplacer par ce fichier.
      </label>

      <div>
        <button type="submit" class="btn--primary" :disabled="busy">Importer</button>
      </div>
    </form>

    <!-- Zone annoncée poliment par les lecteurs d'écran à chaque changement de contenu.
         Doc : https://developer.mozilla.org/fr/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-live -->
    <div class="messages" aria-live="polite">
      <p v-if="message" class="notice" :class="{ 'notice--danger': errors.length > 0 }">
        {{ message }}
      </p>
      <ul v-if="errors.length > 0">
        <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.transfer {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.transfer__intro {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.actions button {
  flex: 1 1 10rem;
}

.import {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
}

fieldset {
  display: flex;
  flex-direction: column;
}

.confirm {
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-danger-soft);
}

.messages ul {
  margin-top: var(--space-2);
  font-size: var(--text-sm);
}
</style>
