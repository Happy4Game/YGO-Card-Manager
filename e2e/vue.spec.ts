import { test, expect } from '@playwright/test'

test("affiche le formulaire de recherche à l'accueil", async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Type' })).toBeVisible()
})
