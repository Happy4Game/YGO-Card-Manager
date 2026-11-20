# Contribuer

Merci de ton intérêt ! Quelques règles simples.

## Règles légales (non négociables)

- Ne jamais ajouter d'image, de logo ou d'export de données de cartes Konami dans le dépôt.
- Dans les tests, utiliser des données fictives.
- Respecter le [guide de l'API YGOPRODeck](https://ygoprodeck.com/api-guide/) : 20 requêtes par
  seconde au maximum, données et images téléchargées une seule fois puis gardées en cache.

## Workflow

1. Crée une branche depuis `master`.
2. Écris des commits au format [Conventional Commits](https://www.conventionalcommits.org/fr/v1.0.0/)
   (`feat:`, `fix:`, `docs:`, `test:`, `chore:`…).
3. Avant d'ouvrir une PR, vérifie en local :

   ```sh
   npm run format:check && npm run lint:ci && npm run type-check && npm run test:unit -- --run
   ```

4. Ouvre une pull request : la CI doit être verte avant la fusion.

## Qualité attendue

- TypeScript sans `any` implicite.
- Chaque fonction métier a un test unitaire.
- Interface accessible ([WCAG 2.2 niveau AA](https://www.w3.org/TR/WCAG22/)) : libellés sur les
  champs, navigation au clavier, contrastes suffisants.
- Pas de `v-html` sur des textes venant de l'API (risque XSS).
