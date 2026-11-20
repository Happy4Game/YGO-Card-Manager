# YGO Card Manager

Application web installable sur mobile (PWA) pour gérer sa collection de cartes à la maison.
Les données restent sur ton appareil : pas de compte, pas de serveur.

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
- Aucune donnée personnelle n'est envoyée à un serveur, aucun traceur.
- Les données de test sont fictives.

## Développement

Prérequis : Node.js 20.19+ ou 22.12+.

```sh
npm install
npm run dev            # serveur de développement
npm run test:unit      # tests unitaires (Vitest)
npm run test:e2e       # tests de bout en bout (Playwright)
npm run lint           # oxlint + ESLint avec corrections
npm run format         # Prettier
npm run type-check     # vue-tsc
npm run build          # type-check + build de production
npm run spike:api      # mesure CORS et taille des données de l'API (3 requêtes)
```

La CI (`.github/workflows/ci.yml`) vérifie le format, le lint, les types, les tests unitaires,
le build, l'audit de sécurité des dépendances et les tests e2e à chaque PR.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md).

## Historique

Une première version utilisait un backend Express + PostgreSQL (dépôt `YGO-Card-Manager-Back`).
Il est abandonné au profit d'une approche local-first : la collection est stockée dans le
navigateur (IndexedDB).
