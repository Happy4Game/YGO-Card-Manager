import { test, expect } from '@playwright/test'

// Critères d'installation d'une PWA : manifeste valide, icônes 192 et 512 px, service worker.
// Doc : https://web.dev/articles/install-criteria
test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

test('le manifeste déclare un nom, un mode standalone et les icônes requises', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    '/manifest.webmanifest',
  )
  const response = await page.request.get('/manifest.webmanifest')
  expect(response.ok()).toBe(true)
  const manifest = (await response.json()) as {
    name?: string
    display?: string
    icons?: { sizes?: string }[]
  }
  expect(manifest.name).toBeTruthy()
  expect(manifest.display).toBe('standalone')
  const sizes = (manifest.icons ?? []).map((icon) => icon.sizes)
  expect(sizes).toContain('192x192')
  expect(sizes).toContain('512x512')
})

// Le service worker n'est généré qu'au build : ce test ne tourne qu'en CI (npm run preview).
if (process.env.CI) {
  test('un service worker est actif après le chargement (build de production)', async ({
    page,
  }) => {
    await page.goto('/')
    const active = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return registration.active !== null
    })
    expect(active).toBe(true)
  })

  test('les 4 pages restent accessibles hors ligne (précache du service worker)', async ({
    page,
    context,
  }) => {
    await page.goto('/')
    // `ready` attend un service worker actif, donc un précache terminé.
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready
    })
    await context.setOffline(true)

    for (const [path, heading] of [
      ['/collection/?add=12345678&set=TST-FR001', 'Ma collection'],
      ['/scan/', 'Scanner'],
      ['/about/', 'À propos'],
      ['/', 'Recherche'],
    ] as const) {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
    }
  })
}
