import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Audit automatique d'accessibilité avec axe-core sur chaque page.
// Doc : https://playwright.dev/docs/accessibility-testing
// axe ne trouve qu'une partie des problèmes : les tests au clavier et au lecteur d'écran restent utiles.
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

for (const path of ['/', '/#/collection', '/#/about']) {
  test(`aucune violation WCAG 2.2 AA détectée sur ${path}`, async ({ page }) => {
    await page.goto(path)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze()
    expect(results.violations).toEqual([])
  })
}
