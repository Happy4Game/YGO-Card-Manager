# YGO Card Manager

Application web installable sur mobile (PWA, nom affiché « Card Manager ») pour gérer sa
collection de cartes à la maison. Les données restent sur ton appareil : pas de compte, pas de
serveur, et l'app fonctionne hors ligne une fois les cartes téléchargées.

## Installer l'app sur son téléphone

Adresse : <https://happy4game.github.io/YGO-Card-Manager/> (déployée automatiquement à chaque
fusion sur `master` par `.github/workflows/deploy.yml`).

- **Android (Chrome)** : ouvrir le site, menu ⋮ > « Installer l'application ».
- **iPhone (Safari)** : bouton Partager > « Sur l'écran d'accueil ».

> **Projet non officiel.** Ce projet n'est ni produit, ni approuvé, ni affilié à Konami Digital
> Entertainment ou 4K Media. Yu-Gi-Oh! est une marque de Konami. Les noms, textes et illustrations
> des cartes appartiennent à leurs propriétaires. Les données de cartes proviennent de l'API publique
> [YGOPRODeck](https://ygoprodeck.com/api-guide/).

## Principes « légal et ouvert »

- Le **code** est sous licence [MIT](LICENSE).
- **Aucune image ni donnée de carte n'est versionnée dans ce dépôt ni hébergée par le projet.**
  Chaque appareil télécharge ce dont il a besoin une seule fois et le garde en cache, comme le
  demande le [guide de l'API YGOPRODeck](https://ygoprodeck.com/api-guide/) (limite de 20 requêtes
  par seconde, pas de lien direct répété vers les images).
- Usage personnel et non commercial : pas de publicité, pas de vente.
- Les images de cartes sont chargées depuis le serveur de YGOPRODeck au premier affichage, puis
  gardées dans le cache du service worker (300 images au maximum). Elles peuvent être désactivées
  dans « À propos > Réglages ».
- Le script `npm run check:assets` (lancé en CI) refuse toute image hors de `public/icons/` et tout
  gros fichier JSON.
- Aucune donnée personnelle n'est envoyée à un serveur, aucun traceur.
- Les données de test sont fictives.

## Développement

Prérequis : Node.js 22.23.4+ (exigé par Astro 7).

### Stack

- **[Astro](https://docs.astro.build/fr/)** génère un site statique de 4 pages
  (`src/pages/` : Recherche `/`, Scanner `/scan/`, Collection `/collection/`, À propos `/about/`)
  avec un gabarit commun (`src/layouts/AppLayout.astro`) : en-tête, barre d'onglets en bas sur
  mobile, pied de page légal.
- **Vue 3 en « îles »** ([doc](https://docs.astro.build/fr/concepts/islands/)) : chaque page monte
  un composant de `src/components/pages/` avec `client:only="vue"` (IndexedDB et caméra n'existent
  que dans le navigateur). Pinia est branché pour chaque île via `src/pages/_app.ts`.
- Pourquoi ? Astro livre du HTML déjà prêt (affichage immédiat, navigation simple par liens, pas
  de routeur), et Vue ne s'occupe que des zones interactives.
- **Styles** : jetons de design dans `src/styles/tokens.css` (couleurs, espacements, mode sombre),
  styles globaux dans `src/styles/global.css` (boutons `.btn--primary/secondary/ghost/danger`,
  champs, `.surface`, `.chip`, `.badge`, `.visually-hidden`…).
- **PWA** : `@vite-pwa/astro` génère le manifeste et le service worker (les 4 pages sont
  précachées, l'app marche hors ligne). La Content-Security-Policy est produite par Astro
  (`security.csp` dans `astro.config.ts`).
- Données : IndexedDB via [Dexie](https://dexie.org/).

```sh
npm install
npm run dev            # serveur de développement (http://localhost:4321)
npm run preview        # sert le build de production (service worker et CSP actifs)
npm run test:unit      # tests unitaires (Vitest)
npm run test:e2e       # tests de bout en bout (Playwright)
npm run lint           # oxlint + ESLint (dont fichiers .astro) avec corrections
npm run format         # Prettier (dont fichiers .astro)
npm run type-check     # astro check + vue-tsc
npm run build          # type-check + build de production dans dist/
npm run spike:api      # mesure CORS et taille des données de l'API (3 requêtes)
npm run check:assets   # vérifie qu'aucun asset de cartes n'est versionné
```

La CI (`.github/workflows/ci.yml`) vérifie le format, le lint, les types, les tests unitaires,
le build, l'audit de sécurité des dépendances et les tests e2e à chaque PR.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Historique

Une première version utilisait un backend Express + PostgreSQL (dépôt `YGO-Card-Manager-Back`).
Il est abandonné au profit d'une approche local-first : la collection est stockée dans le
navigateur (IndexedDB).
