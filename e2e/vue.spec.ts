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

// La recherche hors ligne après synchronisation est testée dans search.spec.ts.
