import { test, expect } from '@playwright/test'

// Aucun test ne doit joindre la vraie API : toute requête vers YGOPRODeck est interceptée.
// Doc : https://playwright.dev/docs/network#handle-requests
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

// La recherche elle-même a ses propres tests e2e ; ici, on vérifie la page et la navigation.
test("affiche la page de recherche et la navigation à l'accueil", async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1, name: 'Recherche' })).toBeVisible()
  await expect(page).toHaveTitle('Recherche · Card Manager')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await expect(nav.getByRole('link', { name: 'Recherche' })).toHaveAttribute('aria-current', 'page')
  await expect(nav.getByRole('link', { name: 'Scanner' })).toHaveAttribute('href', '/scan/')
  await expect(nav.getByRole('link', { name: 'Collection' })).toHaveAttribute(
    'href',
    '/collection/',
  )
  await expect(nav.getByRole('link', { name: 'À propos' })).toHaveAttribute('href', '/about/')
})

test('la navigation mène à chaque page et marque la page courante', async ({ page }) => {
  await page.goto('/')
  const nav = page.getByRole('navigation', { name: 'Navigation principale' })

  for (const [label, heading] of [
    ['Scanner', 'Scanner'],
    ['Collection', 'Ma collection'],
    ['À propos', 'À propos'],
    ['Recherche', 'Recherche'],
  ] as const) {
    await nav.getByRole('link', { name: label }).click()
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    await expect(nav.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page')
  }
})

test("le lien d'évitement mène au contenu principal", async ({ page }) => {
  await page.goto('/about/')
  await page.keyboard.press('Tab')
  const skipLink = page.getByRole('link', { name: 'Aller au contenu' })
  await expect(skipLink).toBeFocused()
  await skipLink.press('Enter')
  await expect(page.locator('main')).toBeFocused()
})
