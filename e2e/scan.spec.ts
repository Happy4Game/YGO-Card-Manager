/// <reference lib="dom" />
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Page de scan. Aucune vraie caméra n'est nécessaire : getUserMedia est remplacé par le flux
// d'un canvas (canvas.captureStream) sur lequel on dessine une carte FICTIVE. L'OCR, lui, est
// bien réel : Tesseract.js tourne dans le navigateur avec les fichiers auto-hébergés.
// Doc : https://developer.mozilla.org/fr/docs/Web/API/HTMLCanvasElement/captureStream
//
// URL : routeur « hash » de l'app actuelle (à adapter en « /scan/ » après la migration Astro).
const SCAN_URL = '/scan/'

/** Carte FICTIVE (règle légale : jamais de vraies données de cartes). */
const FAKE_CARD = {
  id: 10000001,
  name: 'Dragon de Test',
  type: 'Normal Monster',
  typeLabel: 'Monstre Normal',
  frameType: 'normal',
  desc: 'Un monstre imaginaire utilisé uniquement dans les tests.',
  race: 'Dragon',
  attribute: 'LIGHT',
  atk: 1000,
  def: 800,
  level: 4,
  sets: [{ code: 'TST-FR001', name: 'Boîte de Test', rarity: 'Common' }],
  setKeys: ['TST-001'],
}

type DrawFakeCard = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  name?: string,
  code?: string,
) => void

/** Seconde carte FICTIVE, pour le scan de plusieurs cartes à la fois. */
const FAKE_CARD_2 = {
  ...FAKE_CARD,
  id: 10000002,
  name: 'Golem Imaginaire',
  sets: [{ code: 'AUT-FR007', name: 'Autre Boîte', rarity: 'Ultra Rare' }],
  setKeys: ['AUT-007'],
}

/**
 * Dessine une carte fictive (format 59×86) : cadre, illustration vide, nom et code d'impression
 * placés comme sur une vraie carte (code à droite sous l'illustration). Sérialisée dans la page
 * (fonction autonome : `toString()` puis script d'initialisation).
 */
function drawFakeCard(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  name = 'Dragon de Test',
  code = 'TST-FR001',
): void {
  const width = (height * 59) / 86
  context.fillStyle = '#c98a3d'
  context.fillRect(x, y, width, height)
  context.fillStyle = '#e8d9b5'
  context.fillRect(x + width * 0.05, y + height * 0.035, width * 0.9, height * 0.09)
  context.fillStyle = '#3a4a5c'
  context.fillRect(x + width * 0.12, y + height * 0.18, width * 0.76, height * 0.5)
  context.fillStyle = '#e8d9b5'
  context.fillRect(x + width * 0.06, y + height * 0.79, width * 0.88, height * 0.17)
  context.fillStyle = '#111'
  context.textBaseline = 'middle'
  context.font = `bold ${String(Math.round(height * 0.045))}px sans-serif`
  context.fillText(name, x + width * 0.08, y + height * 0.08)
  context.font = `bold ${String(Math.round(height * 0.032))}px sans-serif`
  context.fillText(code, x + width * 0.6, y + height * 0.733)
}

/**
 * Remplace la caméra par un flux de canvas montrant la carte fictive (ou une erreur).
 * Les scripts d'initialisation de Playwright ne sont pas soumis à la CSP de la page.
 */
async function fakeCamera(
  page: Page,
  mode: 'card' | 'two-cards' | 'denied' | 'none',
  permission: 'prompt' | 'granted' = 'prompt',
) {
  await page.addInitScript({
    content: `window.__drawFakeCard = ${drawFakeCard.toString()}; window.__cameraMode = '${mode}'; window.__cameraPermission = '${permission}';`,
  })
  await page.addInitScript(() => {
    const scope = window as unknown as {
      __drawFakeCard: DrawFakeCard
      __cameraMode: string
      __cameraPermission: string
    }
    // État de l'autorisation indépendant des options du navigateur de test.
    const query = navigator.permissions.query.bind(navigator.permissions)
    navigator.permissions.query = (descriptor) =>
      descriptor.name === 'camera'
        ? Promise.resolve({ state: scope.__cameraPermission } as PermissionStatus)
        : query(descriptor)
    if (scope.__cameraMode === 'none') return
    const getUserMedia = async () => {
      if (scope.__cameraMode === 'denied') {
        throw new DOMException('Permission refusée', 'NotAllowedError')
      }
      const canvas = document.createElement('canvas')
      canvas.width = 1280
      canvas.height = 720
      const context = canvas.getContext('2d')
      if (!context) throw new DOMException('pas de canvas', 'NotReadableError')
      const paint = () => {
        context.fillStyle = '#20252e'
        context.fillRect(0, 0, canvas.width, canvas.height)
        const height = canvas.height * 0.84
        const width = (height * 59) / 86
        const top = (canvas.height - height) / 2
        if (scope.__cameraMode === 'two-cards') {
          scope.__drawFakeCard(context, canvas.width / 2 - width - 24, top, height)
          scope.__drawFakeCard(
            context,
            canvas.width / 2 + 24,
            top,
            height,
            'Golem Imaginaire',
            'AUT-FR007',
          )
        } else {
          scope.__drawFakeCard(context, (canvas.width - width) / 2, top, height)
        }
      }
      paint()
      setInterval(paint, 100)
      return canvas.captureStream(10)
    }
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia, enumerateDevices: () => Promise.resolve([]) },
    })
  })
}

/** Ajoute les cartes fictives dans IndexedDB (base créée par l'app au premier affichage). */
async function seedCard(page: Page) {
  await expect(page.getByText('Aucune carte n’est encore enregistrée')).toBeVisible()
  await page.evaluate(
    async (cards) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('card-manager')
        request.onerror = () => reject(request.error ?? new Error('IndexedDB'))
        request.onsuccess = () => {
          const tx = request.result.transaction('cards', 'readwrite')
          for (const item of cards) tx.objectStore('cards').put(item)
          tx.oncomplete = () => {
            request.result.close()
            resolve()
          }
          tx.onerror = () => reject(tx.error ?? new Error('transaction'))
        }
      })
    },
    [FAKE_CARD, FAKE_CARD_2],
  )
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Scanner une carte', level: 1 })).toBeVisible()
}

const expectAddLink = (page: Page) =>
  expect(page.getByRole('link', { name: /^Détails de l'ajout/ })).toHaveAttribute(
    'href',
    /\/collection\/\?add=10000001&set=TST-FR001$/,
  )

let cspErrors: string[] = []

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/(db|images)\.ygoprodeck\.com\//, (route) => route.abort())
  // Aucune violation de CSP tolérée (lecteur OCR auto-hébergé, sans CDN ni blob:).
  cspErrors = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
      cspErrors.push(message.text())
    }
  })
})

test.afterEach(() => {
  expect(cspErrors).toEqual([])
})

test('affiche la page, les solutions de repli et aucune violation WCAG', async ({ page }) => {
  await fakeCamera(page, 'none')
  await page.goto(SCAN_URL)
  await expect(page.getByRole('heading', { name: 'Scanner une carte', level: 1 })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Activer la caméra' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importer une photo' }).first()).toBeVisible()
  await expect(page.getByLabel('Code d’impression')).toBeVisible()
  // Base vide : on invite à télécharger les cartes depuis la recherche.
  await expect(page.getByRole('link', { name: 'Télécharger la liste des cartes' })).toBeVisible()

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()
  expect(results.violations).toEqual([])
})

test('explique un refus de la caméra et garde l’import de photo', async ({ page }) => {
  await fakeCamera(page, 'denied')
  await page.goto(SCAN_URL)
  await page.getByRole('button', { name: 'Activer la caméra' }).click()
  await expect(page.locator('.overlay-error')).toContainText("L'accès à la caméra a été refusé")
  await expect(page.getByRole('status')).toContainText('refusé')
  await expect(page.getByRole('button', { name: 'Réessayer la caméra' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Importer une photo' }).first()).toBeVisible()
})

test('autorisation déjà donnée : la caméra démarre seule et s’arrête', async ({ page }) => {
  await fakeCamera(page, 'card', 'granted')
  await page.goto(SCAN_URL)
  const stop = page.getByRole('button', { name: 'Arrêter la caméra' })
  await expect(stop).toBeVisible()
  await expect(page.getByRole('status')).toContainText('Montre une ou plusieurs cartes')
  await stop.click()
  await expect(page.getByRole('button', { name: 'Activer la caméra' })).toBeVisible()
})

test('saisie manuelle du code : affiche la carte et le lien d’ajout', async ({ page }) => {
  await fakeCamera(page, 'none')
  await page.goto(SCAN_URL)
  await seedCard(page)
  await page.getByLabel('Code d’impression').fill('tst-fr001')
  await page.getByRole('button', { name: 'Chercher', exact: true }).click()

  const sheet = page.getByRole('region', { name: 'Dragon de Test' })
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { name: 'Dragon de Test' })).toBeFocused()
  await expect(sheet).toContainText('Monstre Normal')
  await expect(sheet).toContainText('Boîte de Test')
  await expect(sheet.getByLabel("Code d'impression lu")).toHaveValue('TST-FR001')
  await expectAddLink(page)

  await sheet.getByRole('button', { name: 'Scanner une autre carte' }).click()
  await expect(sheet).toBeHidden()
  // La carte reste dans « Scans récents », avec un lien d'ajout rapide.
  await expect(
    page.getByRole('link', { name: 'Ajouter Dragon de Test (TST-FR001) à ma collection' }),
  ).toBeVisible()
})

test('code inconnu : propose de corriger ou de chercher par nom', async ({ page }) => {
  await fakeCamera(page, 'none')
  await page.goto(SCAN_URL)
  await page.getByLabel('Code d’impression').fill('ZZQ-FR404')
  await page.getByRole('button', { name: 'Chercher', exact: true }).click()
  const sheet = page.getByRole('region', { name: 'Carte introuvable' })
  await expect(sheet).toContainText('ZZQ-FR404')
  await expect(sheet.getByRole('link', { name: 'Chercher la carte par son nom' })).toBeVisible()
})

test.describe('OCR réel (Tesseract.js dans le navigateur)', () => {
  // Premier chargement du moteur (~4 Mo) et des données de langue (~3 Mo), puis la lecture.
  test.setTimeout(90_000)

  const tray = (page: Page) => page.getByRole('region', { name: /Cartes détectées/ })

  test('lit en continu le code d’une carte filmée', async ({ page }) => {
    await fakeCamera(page, 'card')
    await page.goto(SCAN_URL)
    await seedCard(page)
    await page.getByRole('button', { name: 'Activer la caméra' }).click()
    await expect(page.getByRole('button', { name: 'Arrêter la caméra' })).toBeVisible()

    await expect(tray(page)).toContainText('Dragon de Test', { timeout: 60_000 })
    await expect(tray(page)).toContainText('TST-FR001')
    await expect(page.getByRole('status').first()).toContainText('Carte détectée : Dragon de Test')
    await expectAddLink(page)
  })

  test('lit plusieurs cartes à la fois et les ajoute d’un coup', async ({ page }) => {
    await fakeCamera(page, 'two-cards')
    await page.goto(SCAN_URL)
    await seedCard(page)
    await page.getByRole('button', { name: 'Activer la caméra' }).click()

    await expect(tray(page)).toContainText('Dragon de Test', { timeout: 60_000 })
    await expect(tray(page)).toContainText('Golem Imaginaire', { timeout: 30_000 })
    // La rareté de l'impression lue est proposée.
    await expect(tray(page).getByLabel('Rareté de Golem Imaginaire')).toHaveValue('Ultra Rare')

    await tray(page).getByRole('button', { name: 'Ajouter 2 cartes à ma collection' }).click()
    await expect(page.getByRole('status').first()).toContainText(
      '2 cartes ajoutées à ta collection.',
    )
    await expect(tray(page)).toBeHidden()
  })

  test('le bouton photo fige l’image et lit toutes les cartes', async ({ page }) => {
    await fakeCamera(page, 'two-cards')
    await page.goto(SCAN_URL)
    await seedCard(page)
    await page.getByRole('button', { name: 'Activer la caméra' }).click()
    await page.getByRole('button', { name: 'Prendre une photo et lire toutes les cartes' }).click()

    await expect(page.getByRole('status').first()).toContainText(
      '2 cartes reconnues sur la photo',
      {
        timeout: 60_000,
      },
    )
    await expect(tray(page)).toContainText('Golem Imaginaire')
    await page.getByRole('button', { name: 'Reprendre la caméra' }).click()
    await expect(
      page.getByRole('button', { name: 'Prendre une photo et lire toutes les cartes' }),
    ).toBeVisible()
  })

  test('lit le code sur une photo importée', async ({ page }) => {
    await fakeCamera(page, 'none')
    await page.goto(SCAN_URL)
    await seedCard(page)
    const dataUrl = await page.evaluate(() => {
      const draw = (window as unknown as { __drawFakeCard: DrawFakeCard }).__drawFakeCard
      const canvas = document.createElement('canvas')
      canvas.width = 590
      canvas.height = 860
      const context = canvas.getContext('2d')
      if (!context) throw new Error('canvas')
      draw(context, 0, 0, 860)
      return canvas.toDataURL('image/png')
    })
    await page.locator('input[type="file"]').setInputFiles({
      name: 'carte-fictive.png',
      mimeType: 'image/png',
      buffer: Buffer.from(dataUrl.split(',')[1] ?? '', 'base64'),
    })
    await expect(tray(page)).toContainText('Dragon de Test', { timeout: 60_000 })
    await expectAddLink(page)
  })
})
