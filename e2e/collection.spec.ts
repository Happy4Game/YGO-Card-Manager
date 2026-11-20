import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

// Chaque test Playwright démarre avec un contexte de navigateur neuf : IndexedDB est vide.
// Aucun appel réseau : la carte 12345678 (fictive) n'est pas dans le cache local.

test('affiche un état vide expliquant comment ajouter des cartes', async ({ page }) => {
  await page.goto('/collection/')
  await expect(page.getByRole('heading', { name: 'Ma collection', level: 1 })).toBeVisible()
  await expect(page.getByText('Ta collection est vide.')).toBeVisible()
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Recherche' })).toHaveAttribute('href', '/')
  await expect(main.getByRole('link', { name: 'scanne-la' })).toHaveAttribute('href', '/scan/')
})

test("pré-remplit le code d'impression depuis ?set= puis nettoie l'URL", async ({ page }) => {
  await page.goto('/collection/?add=12345678&set=tst-fr002')

  const form = page.getByRole('form', { name: 'Ajouter une carte' })
  await expect(form.getByLabel('Identifiant de la carte (passcode)')).toHaveValue('12345678')
  await expect(form.getByLabel("Code d'impression")).toHaveValue('TST-FR002')

  await form.getByRole('button', { name: 'Annuler' }).click()
  await expect(form).toBeHidden()
  await expect(page).toHaveURL(/\/collection\/$/)
})

test('ajoute, incrémente puis supprime une entrée', async ({ page }) => {
  await page.goto('/collection/?add=12345678')

  const form = page.getByRole('form', { name: 'Ajouter une carte' })
  await expect(form).toBeVisible()
  await expect(form.getByLabel('Identifiant de la carte (passcode)')).toHaveValue('12345678')
  await expect(form.getByText('Carte #12345678 : nom inconnu')).toBeVisible()

  await form.getByLabel("Code d'impression").fill('TST-FR001')
  await form.getByLabel('Langue').selectOption('fr')
  await form.getByLabel('État').selectOption('Near Mint')
  await form.getByLabel('Emplacement').fill('Classeur test')
  await form.getByRole('button', { name: 'Enregistrer' }).click()

  await expect(form).toBeHidden()
  await expect(page).not.toHaveURL(/add=/)
  await expect(page.getByRole('status')).toContainText('Ajouté à la collection : Carte #12345678')

  const entry = page.getByRole('article', { name: 'Carte #12345678' })
  await expect(entry).toContainText('TST-FR001')
  await expect(entry).toContainText('Classeur test')
  await expect(entry).toContainText('Quantité : 1')

  await entry.getByRole('button', { name: 'Ajouter un exemplaire de Carte #12345678' }).click()
  await expect(entry).toContainText('Quantité : 2')

  await entry.getByRole('button', { name: 'Supprimer Carte #12345678' }).click()
  // Confirmation intégrée : le focus va sur « Annuler », le choix le plus sûr.
  await expect(entry.getByRole('button', { name: 'Annuler' })).toBeFocused()
  await entry.getByRole('button', { name: 'Oui, supprimer' }).click()

  await expect(entry).toBeHidden()
  await expect(page.getByText('Ta collection est vide.')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Mes cartes' })).toBeFocused()
})
