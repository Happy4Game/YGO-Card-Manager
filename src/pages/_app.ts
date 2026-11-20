import type { App } from 'vue'
import { createPinia } from 'pinia'

/**
 * Point d'entrée Vue appelé par Astro pour chaque île (composant `client:*`).
 * Le préfixe « _ » empêche Astro d'en faire une page.
 * Doc : https://docs.astro.build/fr/guides/integrations-guide/vue/#appentrypoint
 */
export default (app: App): void => {
  app.use(createPinia())
}
