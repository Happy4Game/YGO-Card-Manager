import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Cartes FICTIVES au format de l'API YGOPRODeck (règle légale : aucune vraie carte).
const cards = [
  {
    id: 10000001,
    name: 'Dragon de Cristal Fictif',
    name_en: 'Fictional Crystal Dragon',
    type: 'Effect Monster',
    humanReadableCardType: 'Monstre à Effet',
    frameType: 'effect',
    desc: 'Quand cette carte est invoquée : piochez 1 carte.',
    race: 'Dragon',
    attribute: 'LIGHT',
    atk: 2800,
    def: 2000,
    level: 7,
    card_sets: [{ set_code: 'FIC-FR001', set_name: 'Boîte Fictive', set_rarity: 'Ultra Rare' }],
  },
  {
    id: 10000002,
    name: 'Petit Dragon Fictif',
    type: 'Normal Monster',
    frameType: 'normal',
    desc: 'Un petit dragon imaginaire.',
    race: 'Dragon',
    attribute: 'WIND',
    atk: 1200,
    def: 900,
    level: 3,
    card_sets: [{ set_code: 'FIC-FR002', set_name: 'Boîte Fictive', set_rarity: 'Common' }],
  },
  {
    id: 10000003,
    name: 'Guerrier Imaginaire',
    type: 'Normal Monster',
    frameType: 'normal',
    desc: 'Un guerrier inventé pour les tests.',
    race: 'Warrior',
    attribute: 'EARTH',
    atk: 2100,
    def: 1000,
    level: 4,
    card_sets: [{ set_code: 'AUT-FR010', set_name: 'Autre Boîte', set_rarity: 'Rare' }],
  },
  {
    id: 10000004,
    name: 'Sort Imaginaire',
    type: 'Spell Card',
    frameType: 'spell',
    desc: 'Piochez 2 cartes.',
    race: 'Quick-Play',
    card_sets: [{ set_code: 'FIC-FR003', set_name: 'Boîte Fictive', set_rarity: 'Common' }],
  },
]

async function syncFictionalCards(page: Page) {
  await page.route('https://db.ygoprodeck.com/api/v7/checkDBVer.php', (route) =>
    route.fulfill({ json: [{ database_version: 'test-1', last_update: '2026-01-01' }] }),
  )
  await page.route('https://db.ygoprodeck.com/api/v7/cardinfo.php?language=fr', (route) =>
    route.fulfill({ json: { data: cards } }),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Télécharger / mettre à jour les cartes' }).click()
  await expect(page.getByRole('searchbox', { name: 'Rechercher des cartes' })).toBeVisible()
  await expect(page.getByText('4 cartes', { exact: true })).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  // Aucun accès réseau réel : images et API sont interceptées.
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
})

test('recherche universelle, code d’impression et lien d’ajout', async ({ page }) => {
  await syncFictionalCards(page)
  const search = page.getByRole('searchbox', { name: 'Rechercher des cartes' })

  await search.fill('atk>=2000 type:dragon')
  await expect(page.getByText('1 carte', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Dragon de Cristal Fictif' })).toBeVisible()
  const chips = page.getByRole('list', { name: 'Critères compris' })
  await expect(chips).toContainText('ATK ≥ 2000')
  await expect(chips).toContainText('Type : Dragon')

  // Nom anglais : trouvé aussi, affiché en second.
  await search.fill('crystal')
  await expect(page.getByText('1 carte', { exact: true })).toBeVisible()
  await expect(page.getByText('Fictional Crystal Dragon')).toBeVisible()

  // Code d'impression (avec ou sans région) : le lien d'ajout reprend le code.
  await search.fill('fic-fr002')
  await expect(page.getByRole('heading', { name: 'Petit Dragon Fictif' })).toBeVisible()
  await expect(page.getByText('1 carte', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('link', { name: 'Ajouter à ma collection : Petit Dragon Fictif' }),
  ).toHaveAttribute('href', '/collection/?add=10000002&set=FIC-FR002')

  // Retirer la puce vide la recherche.
  await page.getByRole('button', { name: /Retirer le critère Code FIC-FR002/ }).click()
  await expect(search).toHaveValue('')
  await expect(page.getByText('4 cartes', { exact: true })).toBeVisible()
})

test('le mode avancé réécrit la saisie universelle et inversement', async ({ page }) => {
  await syncFictionalCards(page)
  const search = page.getByRole('searchbox', { name: 'Rechercher des cartes' })

  const toggle = page.getByRole('button', { name: 'Recherche avancée' })
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  const form = page.getByRole('form', { name: 'Recherche avancée' })

  await form.getByRole('group', { name: 'ATK' }).getByLabel('min.').fill('2000')
  await expect(search).toHaveValue('atk>=2000')
  await expect(page.getByText('2 cartes', { exact: true })).toBeVisible()

  await form.getByLabel('Attribut').selectOption({ label: 'Terre' })
  await expect(search).toHaveValue('atk>=2000 attr:terre')
  await expect(page.getByRole('heading', { name: 'Guerrier Imaginaire' })).toBeVisible()

  const top = form.getByRole('button', { name: 'Haut', exact: true })
  await expect(top).toHaveAttribute('aria-pressed', 'false')

  // Taper dans le champ universel met à jour les contrôles.
  await search.fill('niv:3 fleche:haut')
  await expect(form.getByRole('group', { name: 'Niveau / Rang' }).getByLabel('min.')).toHaveValue(
    '3',
  )
  await expect(top).toHaveAttribute('aria-pressed', 'true')
  await expect(form.getByLabel('Attribut')).toHaveValue('')
})

test('l’aide liste la syntaxe et ses exemples', async ({ page }) => {
  await syncFictionalCards(page)
  const help = page.getByRole('button', { name: 'Aide sur la syntaxe de recherche' })
  await help.click()
  await expect(help).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('heading', { name: 'Comment chercher ?' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(help).toHaveAttribute('aria-expanded', 'false')
  await expect(help).toBeFocused()
})

test('mobile 360 px : pas de défilement horizontal ni de violation axe', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 })
  await syncFictionalCards(page)
  await page.getByRole('button', { name: 'Recherche avancée' }).click()
  await page.getByRole('button', { name: 'Aide sur la syntaxe de recherche' }).click()
  await page.getByRole('searchbox', { name: 'Rechercher des cartes' }).fill('dragon -petit')
  await expect(page.getByText('1 carte', { exact: true })).toBeVisible()

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})
