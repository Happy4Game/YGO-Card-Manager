import { test, expect } from '@playwright/test'

// Aucun test ne doit joindre la vraie API : toute requête vers YGOPRODeck est interceptée.
// Doc : https://playwright.dev/docs/network#handle-requests
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

test("affiche la page de recherche et la navigation à l'accueil", async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Recherche' })).toBeVisible()

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Recherche' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'Ma collection' })).toBeVisible()
  await expect(nav.getByRole('link', { name: 'À propos' })).toBeVisible()

  await expect(
    page.getByRole('button', { name: 'Télécharger / mettre à jour les cartes' }),
  ).toBeVisible()
})

test('télécharge des cartes fictives puis les recherche hors ligne', async ({ page }) => {
  await page.route('https://db.ygoprodeck.com/api/v7/checkDBVer.php', (route) =>
    route.fulfill({ json: [{ database_version: 'test-1', last_update: '2026-01-01' }] }),
  )
  await page.route('https://db.ygoprodeck.com/api/v7/cardinfo.php?language=fr', (route) =>
    route.fulfill({
      json: {
        data: [
          { id: 10000001, name: 'Golem de Test', type: 'Normal Monster', race: 'Rock', atk: 1 },
          { id: 10000002, name: 'Sort Imaginaire', type: 'Spell Card', race: 'Normal' },
        ],
      },
    }),
  )

  await page.goto('/')
  await page.getByRole('button', { name: 'Télécharger / mettre à jour les cartes' }).click()
  await expect(page.getByText('2 cartes enregistrées sur cet appareil.')).toBeVisible()

  await page.getByLabel('Nom de la carte').fill('golem')
  await page.getByRole('button', { name: 'Rechercher' }).click()
  await expect(page.getByText('1 carte trouvée, page 1 sur 1.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Golem de Test' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Ajouter à ma collection/ })).toHaveAttribute(
    'href',
    '#/collection?add=10000001',
  )
})
