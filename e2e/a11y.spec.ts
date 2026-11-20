import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Audit automatique d'accessibilité avec axe-core sur chaque page.
// Doc : https://playwright.dev/docs/accessibility-testing
// axe ne trouve qu'une partie des problèmes : les tests au clavier et au lecteur d'écran restent utiles.
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

const PAGES = ['/', '/scan/', '/collection/', '/about/']

async function audit(page: Page, path: string) {
  await page.goto(path)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  // Astro retire l'attribut `ssr` d'une île une fois le composant Vue affiché.
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0)
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
}

for (const path of PAGES) {
  test(`aucune violation WCAG 2.2 AA détectée sur ${path}`, async ({ page }) => {
    await audit(page, path)
  })
}

// Même audit sur un petit téléphone (360 px) : barre d'onglets en bas, mise en page étroite.
test.describe('mobile 360 px', () => {
  test.use({ viewport: { width: 360, height: 740 } })

  for (const path of PAGES) {
    test(`aucune violation WCAG 2.2 AA ni défilement horizontal sur ${path}`, async ({ page }) => {
      await audit(page, path)
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(0)
    })
  }
})
