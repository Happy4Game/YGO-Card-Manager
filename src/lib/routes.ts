/**
 * URLs internes de l'application. `import.meta.env.BASE_URL` vaut « / » en local et
 * « /YGO-Card-Manager/ » sur GitHub Pages : on ne code jamais un chemin absolu en dur.
 * Doc : https://vite.dev/guide/env-and-mode#built-in-constants
 */
const base = import.meta.env.BASE_URL.endsWith('/')
  ? import.meta.env.BASE_URL
  : `${import.meta.env.BASE_URL}/`

export const routes = {
  search: () => base,
  collection: () => `${base}collection/`,
  scan: () => `${base}scan/`,
  about: () => `${base}about/`,
  /** Ouvre le formulaire d'ajout pré-rempli (code d'impression facultatif, ex. depuis le scan). */
  collectionAdd: (cardId: number, setCode?: string) => {
    const params = new URLSearchParams({ add: String(cardId) })
    if (setCode) params.set('set', setCode)
    return `${base}collection/?${params.toString()}`
  },
}
