<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef } from 'vue'
import ScanResultSheet from '@/components/scan/ScanResultSheet.vue'
import ScanTray from '@/components/scan/ScanTray.vue'
import ScanViewfinder, { type OverlayBox } from '@/components/scan/ScanViewfinder.vue'
import type { DetectedCard, SheetContent } from '@/components/scan/types'
import { db } from '@/db/database'
import type { CardData } from '@/domain/card'
import { routes } from '@/lib/routes'
import {
  cameraAvailability,
  cameraErrorKind,
  cameraErrorMessage,
  listCameras,
  nextCameraId,
  setTorch,
  startCamera,
  stopStream,
  type CameraSession,
} from '@/services/scan/camera'
import { CARD_ZONES, cardFrameInBox, zoneInFrame } from '@/services/scan/cardFrame'
import { captureZone, loadPhoto } from '@/services/scan/frameCapture'
import { countCards, loadNameIndex, matchingSet, resolveCandidates } from '@/services/scan/lookup'
import {
  captureWhole,
  codesInLines,
  createDetectionTracker,
  resolveDetections,
  type CodeDetection,
  type ResolvedDetection,
} from '@/services/scan/multiScan'
import { bestNameMatches, type NameCandidate } from '@/services/scan/nameMatch'
import type { OcrEngine, OcrProgress } from '@/services/scan/ocrEngine'
import { normalizeManualCode, setCodeCandidates } from '@/services/scan/ocrText'
import {
  addRecentScan,
  loadRecentScans,
  saveRecentScans,
  sessionStore,
  type RecentScan,
} from '@/services/scan/recentScans'
import { createScanLoop } from '@/services/scan/scanLoop'
import { takeStill } from '@/services/scan/still'
import { quickAdd } from '@/services/quickAdd'

/**
 * Page « Scanner » : on pointe la caméra sur une ou plusieurs cartes ; les codes d'impression
 * sont lus sur l'appareil (OCR) et entourés en direct. Le bouton « photo » fige l'image et
 * la lit en haute résolution. Les cartes reconnues s'empilent dans « Cartes détectées »,
 * puis s'ajoutent à la collection d'un coup.
 * Repli : photo importée, lecture du nom, ou saisie manuelle du code.
 */

/** Délai sans lecture avant de proposer « Lire le nom ». */
const HINT_DELAY_MS = 6000

const viewfinder = useTemplateRef<InstanceType<typeof ScanViewfinder>>('viewfinder')
const fileInput = useTemplateRef<HTMLInputElement>('fileInput')

// --- État -----------------------------------------------------------------------------------
const cardCount = ref<number>()
const camera = shallowRef<CameraSession>()
const cameraState = ref<'idle' | 'starting' | 'live' | 'error'>('idle')
const cameraError = ref('')
const cameras = ref<MediaDeviceInfo[]>([])
const torchOn = ref(false)

const engineState = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const engineProgress = ref(0)
const engineStep = ref('')
let engine: Promise<OcrEngine> | undefined

const sheet = shallowRef<SheetContent>()
const flash = ref(false)
/** Codes entourés sur la vidéo (ou sur l'image figée). */
const boxes = ref<OverlayBox[]>([])
/** Image figée (bouton « photo » ou photo importée), affichée à la place de la vidéo. */
const still = shallowRef<{ url: string; width: number; height: number }>()
/** Cartes reconnues, en attente d'ajout. */
const detected = ref<DetectedCard[]>([])
const adding = ref(false)
/** « Lire le nom » : un cadre au format carte apparaît pour centrer une seule carte. */
const guide = ref(false)
const showNameHint = ref(false)
const busyLabel = ref('')
const announcement = ref('')
const manualCode = ref('')
const manualError = ref('')
const recent = ref<RecentScan[]>(loadRecentScans(sessionStore()))
let photo: ImageBitmap | undefined
let nameIndex: Promise<NameCandidate[]> | undefined

const tracker = createDetectionTracker({ required: 2 })
let scanStartedAt = 0
let tickCount = 0
let resumeOnVisible = false

const viewMode = computed(() => {
  if (flash.value) return 'success'
  if (cameraState.value !== 'live' && !still.value) return 'idle'
  return sheet.value || busyLabel.value || still.value ? 'paused' : 'scanning'
})
/** HTTPS et navigateur compatible : sinon seuls la photo et la saisie sont proposées. */
const cameraUsable = cameraAvailability() === 'ok'
const canSwitchCamera = computed(() => cameras.value.length > 1)
const progressPercent = computed(() => Math.round(engineProgress.value * 100))

function announce(text: string) {
  announcement.value = text
}

// --- Moteur OCR (chargé à la demande) --------------------------------------------------------
function getEngine(): Promise<OcrEngine> {
  if (!engine) {
    engineState.value = 'loading'
    engineProgress.value = 0
    const onProgress = (progress: OcrProgress) => {
      engineProgress.value = Math.max(engineProgress.value, progress.progress)
      engineStep.value = progress.label
    }
    // import() dynamique : Tesseract.js n'est téléchargé que sur cette page, au premier scan.
    engine = import('@/services/scan/ocrEngine')
      .then(({ createOcrEngine }) => createOcrEngine(onProgress))
      .then((ready) => {
        engineState.value = 'ready'
        return ready
      })
      .catch((error: unknown) => {
        engine = undefined
        engineState.value = 'error'
        announce('Le lecteur de texte n’a pas pu démarrer. Vérifie ta connexion puis réessaie.')
        throw error
      })
  }
  return engine
}

// --- Caméra -------------------------------------------------------------------------------
async function openCamera(deviceId?: string) {
  cameraState.value = 'starting'
  cameraError.value = ''
  closeCamera()
  try {
    const session = await startCamera(deviceId)
    camera.value = session
    torchOn.value = false
    cameraState.value = 'live'
    announce('Caméra active. Montre une ou plusieurs cartes, codes visibles.')
    cameras.value = await listCameras().catch(() => [])
    void getEngine().catch(() => undefined)
    startScanning()
  } catch (error) {
    cameraState.value = 'error'
    cameraError.value = cameraErrorMessage(cameraErrorKind(error))
    announce(cameraError.value)
  }
}

function closeCamera() {
  loop.stop()
  boxes.value = []
  stopStream(camera.value?.stream)
  camera.value = undefined
}

function stopCameraByUser() {
  closeCamera()
  cameraState.value = 'idle'
  announce('Caméra arrêtée.')
}

async function switchCamera() {
  const id = nextCameraId(cameras.value, camera.value?.deviceId)
  if (id) await openCamera(id)
}

async function toggleTorch() {
  const track = camera.value?.track
  if (!track) return
  try {
    await setTorch(track, !torchOn.value)
    torchOn.value = !torchOn.value
  } catch {
    announce('Impossible de piloter la lampe sur cet appareil.')
  }
}

/** Onglet masqué : on coupe la caméra (batterie, vie privée) et on la rallume au retour. */
function onVisibilityChange() {
  if (document.visibilityState === 'hidden') {
    resumeOnVisible = cameraState.value === 'live'
    if (resumeOnVisible) {
      closeCamera()
      cameraState.value = 'idle'
    }
  } else if (resumeOnVisible) {
    resumeOnVisible = false
    void openCamera(camera.value?.deviceId)
  }
}

// --- Lecture continue -----------------------------------------------------------------------
const loop = createScanLoop(scanStep, {
  intervalMs: 600,
  onError: (error) => console.error('[scan]', error),
})

function startScanning() {
  tracker.reset()
  boxes.value = []
  showNameHint.value = false
  scanStartedAt = Date.now()
  if (cameraState.value === 'live' && !still.value) loop.start()
}

const boxLabel = (item: ResolvedDetection) => item.cards[0]?.name ?? item.code

/** Une image de la vidéo : tous les codes visibles, entourés en direct. */
async function scanStep() {
  if (sheet.value || busyLabel.value || still.value) return
  const ocr = await getEngine()
  // Une image sur trois cherche du texte clair (code blanc des cartes Xyz).
  tickCount += 1
  const polarity = tickCount % 3 === 0 ? 'light' : 'dark'
  const frame = viewfinder.value?.captureFrame({ maxSide: 1920, polarity })
  if (!frame) return
  const lines = await ocr.findLines(frame.canvas)
  if (!loop.running || still.value) return
  const resolved = await resolveDetections(db, codesInLines(lines, frame.scale))
  const { visible, confirmed } = tracker.update(resolved, Date.now())
  boxes.value = visible.map((item) => ({
    key: item.key,
    box: item.box,
    label: item.confirmed ? `✓ ${boxLabel(item)}` : item.code,
    state: item.cards.length === 0 ? 'unknown' : item.confirmed ? 'confirmed' : 'seen',
  }))
  const added = confirmed.filter((item) => item.cards.length > 0 && addDetected(item))
  if (added.length > 0) {
    celebrate()
    announce(
      added.length === 1
        ? `Carte détectée : ${boxLabel(added[0] as ResolvedDetection)}.`
        : `${String(added.length)} cartes détectées.`,
    )
    scanStartedAt = Date.now()
  } else if (detected.value.length === 0 && Date.now() - scanStartedAt > HINT_DELAY_MS) {
    showNameHint.value = true
  }
}

function celebrate() {
  flash.value = true
  // Retour haptique discret (Android). Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Navigator/vibrate
  if ('vibrate' in navigator) navigator.vibrate(50)
  setTimeout(() => (flash.value = false), 450)
}

/** Ajoute une détection à « Cartes détectées » (une ligne par code). Renvoie true si nouvelle. */
function addDetected(item: ResolvedDetection): boolean {
  if (detected.value.some((entry) => entry.key === item.key)) return false
  const card = item.cards[0]
  detected.value = [
    {
      key: item.key,
      code: item.code,
      cards: item.cards,
      cardId: card?.id,
      rarity: card ? (matchingSet(card, item.code)?.rarity ?? '') : '',
      selected: card !== undefined,
    },
    ...detected.value,
  ]
  if (card && item.cards.length === 1) rememberScan(card, item.code)
  return true
}

function updateDetected(key: string, changes: Partial<DetectedCard>) {
  detected.value = detected.value.map((item) => {
    if (item.key !== key) return item
    const next = { ...item, ...changes }
    // Autre carte choisie : on reprend la rareté de son impression.
    const card = next.cards.find((entry) => entry.id === next.cardId)
    if (changes.cardId !== undefined && card) {
      next.rarity = matchingSet(card, next.code)?.rarity ?? ''
    }
    return next
  })
}

function removeDetected(key: string) {
  detected.value = detected.value.filter((item) => item.key !== key)
}

/** Ajoute les cartes cochées (un exemplaire chacune, derniers réglages de langue et d'état). */
async function addSelected() {
  const chosen = detected.value.filter((item) => item.selected && item.cardId !== undefined)
  if (chosen.length === 0) return
  adding.value = true
  try {
    for (const item of chosen) {
      const card = item.cards.find((entry) => entry.id === item.cardId)
      if (card) await quickAdd(db, card, { code: item.code, rarity: item.rarity })
    }
    const done = new Set(chosen.map((item) => item.key))
    detected.value = detected.value.filter((item) => !done.has(item.key))
    announce(
      chosen.length === 1
        ? '1 carte ajoutée à ta collection.'
        : `${String(chosen.length)} cartes ajoutées à ta collection.`,
    )
  } catch (error) {
    console.error('[scan]', error)
    announce("L'ajout a échoué. Réessaie.")
  } finally {
    adding.value = false
  }
}

// --- Image figée (bouton « photo » ou photo importée) -----------------------------------------
async function showStill(bitmap: ImageBitmap) {
  const canvas = captureWhole(bitmap, bitmap, { maxSide: 1600, polarity: false }).canvas
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  )
  clearStill()
  if (blob) {
    // URL locale vers l'image (aucun envoi) : https://developer.mozilla.org/fr/docs/Web/API/URL/createObjectURL_static
    still.value = { url: URL.createObjectURL(blob), width: bitmap.width, height: bitmap.height }
  }
}

function clearStill() {
  if (still.value) URL.revokeObjectURL(still.value.url)
  still.value = undefined
}

/** Lecture soignée d'une image figée : plus grande résolution, chaque code lu une fois suffit. */
async function analyzeStill(bitmap: ImageBitmap): Promise<number> {
  const ocr = await getEngine()
  // Jusqu'à 3 200 px de côté, agrandie ×2 au plus : les petits codes deviennent lisibles.
  const detections: CodeDetection[] = []
  // Deux passes : texte sombre (cas courant), puis texte clair (cartes Xyz).
  for (const polarity of ['dark', 'light'] as const) {
    const { canvas, scale } = captureWhole(bitmap, bitmap, { maxSide: 3200, maxScale: 2, polarity })
    detections.push(...codesInLines(await ocr.findLines(canvas), scale))
  }
  const resolved = await resolveDetections(db, detections)
  boxes.value = resolved.map((item) => ({
    key: item.key,
    box: item.box,
    label: item.cards.length > 0 ? `✓ ${boxLabel(item)}` : `? ${item.code}`,
    state: item.cards.length > 0 ? 'confirmed' : 'unknown',
  }))
  for (const item of resolved) addDetected(item)
  return resolved.filter((item) => item.cards.length > 0).length
}

function foundMessage(count: number, source: string) {
  return count === 0
    ? `Aucun code reconnu sur ${source}. Rapproche-toi, évite les reflets, ou saisis le code.`
    : `${String(count)} carte${count > 1 ? 's' : ''} reconnue${count > 1 ? 's' : ''} sur ${source}.`
}

/** Bouton « photo » : fige l'image, la prend en pleine résolution si possible, puis la lit. */
async function takePhoto() {
  const element = viewfinder.value?.videoElement()
  if (!element || busyLabel.value) return
  loop.stop()
  busyLabel.value = 'Analyse de la photo…'
  announce('Photo prise, analyse en cours…')
  try {
    const bitmap = await takeStill(camera.value?.track, element)
    await showStill(bitmap)
    const count = await analyzeStill(bitmap)
    bitmap.close()
    if (count > 0) celebrate()
    announce(foundMessage(count, 'la photo'))
  } catch (error) {
    console.error('[scan]', error)
    announce('La photo n’a pas pu être analysée. Réessaie.')
  } finally {
    busyLabel.value = ''
  }
}

/** Quitte l'image figée et reprend la vidéo en direct. */
function resumeLive() {
  clearStill()
  boxes.value = []
  if (cameraState.value === 'live') {
    announce('Retour à la caméra.')
    startScanning()
  } else if (cameraUsable) {
    void openCamera(camera.value?.deviceId)
  }
}

function openSheet(content: SheetContent) {
  sheet.value = content
  const card = content.kind === 'code' && content.cards.length === 1 ? content.cards[0] : undefined
  if (card && content.kind === 'code') rememberScan(card, content.code)
}

function rememberScan(card: CardData, code: string) {
  recent.value = addRecentScan(recent.value, {
    cardId: card.id,
    name: card.name,
    code,
    at: Date.now(),
  })
  saveRecentScans(sessionStore(), recent.value)
}

function resume() {
  sheet.value = undefined
  announce(cameraState.value === 'live' ? 'Prêt pour la carte suivante.' : '')
  startScanning()
}

/** Code lu par l'OCR sur une photo, sans position : même feuille que la saisie manuelle. */
async function showResolution(code: string, cards: CardData[]) {
  loop.stop()
  celebrate()
  openSheet({ kind: 'code', code, cards })
  announce(
    cards.length === 1
      ? `Code lu : ${code}. ${cards[0]?.name ?? ''}`
      : cards.length > 1
        ? `Code lu : ${code}. ${String(cards.length)} cartes possibles.`
        : `Code lu : ${code}. Aucune carte connue pour ce code.`,
  )
}

// --- Code saisi ou corrigé --------------------------------------------------------------------
async function lookupCode(code: string) {
  loop.stop()
  const resolution = await resolveCandidates(db, setCodeCandidates(code))
  openSheet({ kind: 'code', code: resolution?.code ?? code, cards: resolution?.cards ?? [] })
  announce(
    resolution && resolution.cards.length > 0
      ? `Code ${resolution.code} : ${String(resolution.cards.length)} carte(s) trouvée(s).`
      : `Aucune carte connue pour le code ${code}.`,
  )
}

async function submitManual() {
  const code = normalizeManualCode(manualCode.value)
  if (!code) {
    manualError.value = 'Format attendu : 2 à 5 caractères, un tiret puis le numéro, ex. ABC-FR001.'
    return
  }
  manualError.value = ''
  manualCode.value = code
  await lookupCode(code)
}

function pickCard(card: CardData, code: string) {
  openSheet({ kind: 'code', code, cards: [card] })
  announce(`${card.name} sélectionnée.`)
}

// --- Lecture du nom ---------------------------------------------------------------------------
async function readName() {
  busyLabel.value = 'Lecture du nom…'
  guide.value = true
  announce('Lecture du nom de la carte…')
  try {
    const image = photo
      ? capturePhotoZone(photo, 'name')
      : viewfinder.value?.capture('name', { targetHeight: 80, threshold: false })
    if (!image) {
      announce('Aucune image à lire : active la caméra ou importe une photo.')
      return
    }
    const ocr = await getEngine()
    const reading = await ocr.readName(image, (progress) => {
      engineStep.value = progress.label
    })
    nameIndex ??= loadNameIndex(db)
    const matches = bestNameMatches(reading.text, await nameIndex, { limit: 5 })
    const cards = (await db.cards.bulkGet(matches.map((match) => match.id))).filter(
      (card): card is CardData => card !== undefined,
    )
    loop.stop()
    openSheet({ kind: 'names', query: reading.text, cards })
    announce(
      cards.length > 0
        ? `${String(cards.length)} carte(s) au nom proche de « ${reading.text.trim()} ».`
        : 'Aucun nom reconnu.',
    )
  } catch (error) {
    console.error('[scan]', error)
    announce('La lecture du nom a échoué. Réessaie ou saisis le code.')
  } finally {
    busyLabel.value = ''
    guide.value = false
  }
}

// --- Photo importée ---------------------------------------------------------------------------
function capturePhotoZone(bitmap: ImageBitmap, zone: 'code' | 'name' | 'lower') {
  // On suppose la carte cadrée sur la photo : même géométrie que dans le viseur, sans marge.
  const size = { width: bitmap.width, height: bitmap.height }
  const frame = cardFrameInBox(size.width, size.height, 1)
  return captureZone(bitmap, size, zoneInFrame(frame, CARD_ZONES[zone]), {
    targetHeight: zone === 'code' ? 96 : zone === 'name' ? 80 : 360,
    threshold: zone !== 'name',
  })
}

async function onPhotoChosen(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  closeCamera()
  if (cameraState.value === 'live') cameraState.value = 'idle'
  busyLabel.value = 'Lecture de la photo…'
  announce('Lecture de la photo…')
  try {
    photo?.close()
    photo = await loadPhoto(file)
    await showStill(photo)
    // 1. Tous les codes de la photo (une ou plusieurs cartes, n'importe où).
    const count = await analyzeStill(photo)
    if (count > 0) {
      celebrate()
      announce(foundMessage(count, 'la photo'))
      return
    }
    // 2. Repli : une seule carte cadrée, zone du code puis bas de carte.
    const ocr = await getEngine()
    let resolution = await resolveCandidates(
      db,
      setCodeCandidates((await ocr.readCode(capturePhotoZone(photo, 'code'))).text),
    )
    if (!resolution?.cards.length) {
      const lower = await ocr.readSparse(capturePhotoZone(photo, 'lower'))
      resolution = (await resolveCandidates(db, setCodeCandidates(lower.text))) ?? resolution
    }
    if (resolution) {
      await showResolution(resolution.code, resolution.cards)
    } else {
      showNameHint.value = true
      announce(foundMessage(0, 'la photo'))
    }
  } catch (error) {
    console.error('[scan]', error)
    announce('Impossible de lire cette photo.')
  } finally {
    busyLabel.value = ''
  }
}

function choosePhoto() {
  fileInput.value?.click()
}

// --- Cycle de vie -----------------------------------------------------------------------------
onMounted(async () => {
  document.addEventListener('visibilitychange', onVisibilityChange)
  cardCount.value = await countCards(db).catch(() => 0)
  const availability = cameraAvailability()
  if (availability !== 'ok') {
    cameraState.value = 'error'
    cameraError.value = cameraErrorMessage(availability)
    return
  }
  // Autorisation déjà donnée : on démarre directement, sinon on attend un geste (bouton).
  // Doc MDN : https://developer.mozilla.org/fr/docs/Web/API/Permissions/query
  try {
    const status = await navigator.permissions.query({ name: 'camera' })
    if (status.state === 'granted') await openCamera()
  } catch {
    // Firefox ne connaît pas toujours « camera » : on attend le bouton.
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisibilityChange)
  closeCamera()
  clearStill()
  photo?.close()
  void engine?.then((ready) => ready.terminate()).catch(() => undefined)
})
</script>

<template>
  <section class="scan" aria-labelledby="scan-title">
    <header class="intro">
      <h1 id="scan-title">Scanner une carte</h1>
      <p class="subtitle">
        Montre une ou plusieurs cartes, codes d’impression visibles (ex. ABC-FR001) : ils sont
        entourés dès qu’ils sont lus. La lecture se fait sur ton appareil : aucune image n’est
        envoyée.
      </p>
    </header>

    <p v-if="cardCount === 0" class="notice">
      Aucune carte n’est encore enregistrée sur cet appareil : le scan ne pourra rien reconnaître.
      <a :href="routes.search()">Télécharger la liste des cartes</a>
    </p>

    <ScanViewfinder
      ref="viewfinder"
      :stream="camera?.stream"
      :mode="viewMode"
      :boxes="boxes"
      :still="still"
      :guide="guide"
    >
      <template v-if="still">
        <p class="instruction" aria-hidden="true">{{ busyLabel || 'Image figée' }}</p>
        <div class="still-bar">
          <button
            class="btn btn-glass"
            type="button"
            :disabled="busyLabel !== ''"
            @click="resumeLive"
          >
            Reprendre la caméra
          </button>
        </div>
      </template>

      <div v-else-if="cameraState !== 'live'" class="overlay">
        <template v-if="cameraState === 'starting'">
          <span class="spinner" aria-hidden="true"></span>
          <p>Démarrage de la caméra…</p>
        </template>
        <template v-else>
          <p v-if="cameraState === 'error'" class="overlay-error">{{ cameraError }}</p>
          <p v-else>Montre une ou plusieurs cartes, codes d’impression bien visibles.</p>
          <button v-if="cameraUsable" class="btn btn-primary" type="button" @click="openCamera()">
            {{ cameraState === 'error' ? 'Réessayer la caméra' : 'Activer la caméra' }}
          </button>
          <button class="btn btn-glass" type="button" @click="choosePhoto">
            Importer une photo
          </button>
        </template>
      </div>

      <template v-else>
        <p class="instruction" aria-hidden="true">
          {{
            busyLabel || (guide ? 'Une seule carte dans le cadre' : 'Codes visibles, sans reflet')
          }}
        </p>
        <!-- Déclencheur : fige l'image et la lit en haute résolution. -->
        <button
          class="shutter"
          type="button"
          :disabled="busyLabel !== ''"
          aria-label="Prendre une photo et lire toutes les cartes"
          @click="takePhoto"
        >
          <span class="shutter__ring" aria-hidden="true"></span>
        </button>
        <div class="tools">
          <button
            v-if="camera?.torchSupported"
            class="icon-btn"
            type="button"
            :aria-pressed="torchOn"
            :aria-label="torchOn ? 'Éteindre la lampe' : 'Allumer la lampe'"
            @click="toggleTorch"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 2h8l-1 6h-6zM9 9h6l-1.2 12.5a.6.6 0 0 1-.6.5h-2.4a.6.6 0 0 1-.6-.5z" />
            </svg>
          </button>
          <button
            v-if="canSwitchCamera"
            class="icon-btn"
            type="button"
            aria-label="Changer de caméra"
            @click="switchCamera"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 7h3l2-3h6l2 3h3v13H4zM12 9a4 4 0 0 0-3.9 3H6.5l2.5 3 2.5-3H10a2 2 0 0 1 3.7-1M12 17a4 4 0 0 0 3.9-3h1.6l-2.5-3-2.5 3H14a2 2 0 0 1-3.7 1"
              />
            </svg>
          </button>
          <button
            class="icon-btn"
            type="button"
            aria-label="Arrêter la caméra"
            @click="stopCameraByUser"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6 6 18" />
            </svg>
          </button>
        </div>
      </template>

      <div v-if="engineState === 'loading'" class="engine" aria-hidden="true">
        <span>Préparation du lecteur : {{ progressPercent }} %</span>
        <span class="bar"
          ><span class="bar-fill" :style="{ width: `${progressPercent}%` }"></span
        ></span>
      </div>
    </ScanViewfinder>

    <input
      ref="fileInput"
      class="visually-hidden"
      type="file"
      accept="image/*"
      capture="environment"
      tabindex="-1"
      aria-hidden="true"
      @change="onPhotoChosen"
    />

    <!-- Région annoncée par les lecteurs d'écran (WAI-ARIA, role=status ≈ aria-live polite). -->
    <p class="status" role="status">
      <template v-if="engineState === 'loading'">
        Préparation du lecteur : {{ progressPercent }} %<template v-if="engineStep">
          ({{ engineStep }})</template
        >.
      </template>
      {{ announcement }}
    </p>

    <ScanTray
      v-if="detected.length > 0"
      :items="detected"
      :busy="adding"
      @add="addSelected"
      @remove="removeDetected"
      @clear="detected = []"
      @update="updateDetected"
    />

    <div class="quick-actions">
      <button class="btn btn-ghost" type="button" :disabled="busyLabel !== ''" @click="readName">
        Lire le nom
      </button>
      <button class="btn btn-ghost" type="button" @click="choosePhoto">Importer une photo</button>
    </div>
    <p v-if="showNameHint" class="hint">
      Le code ne se lit pas ? Rapproche les cartes, évite les reflets, prends une photo (bouton
      rond), ou essaie « Lire le nom » avec une seule carte.
    </p>

    <form class="manual" aria-labelledby="manual-title" @submit.prevent="submitManual">
      <h2 id="manual-title" class="section-title">Saisir le code</h2>
      <label class="field-label" for="manual-code">Code d’impression</label>
      <div class="manual-row">
        <input
          id="manual-code"
          v-model="manualCode"
          class="field"
          type="text"
          placeholder="ABC-FR001"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
          pattern="\s*[A-Za-z0-9]{2,5}\s*[\-\s]?\s*[A-Za-z]{0,2}\s*[0-9]{3}\s*"
          title="2 à 5 caractères, un tiret, la région facultative puis 3 chiffres, ex. ABC-FR001"
          :aria-invalid="manualError !== ''"
          :aria-describedby="manualError ? 'manual-error' : undefined"
          required
        />
        <button class="btn btn-primary" type="submit">Chercher</button>
      </div>
      <p v-if="manualError" id="manual-error" class="field-error">{{ manualError }}</p>
      <a class="text-link" :href="routes.search()">Rechercher par nom, type ou autre critère</a>
    </form>

    <section v-if="recent.length > 0" class="recent" aria-labelledby="recent-title">
      <h2 id="recent-title" class="section-title">Scans récents</h2>
      <ul class="recent-list">
        <li v-for="scan in recent" :key="`${scan.cardId}-${scan.code}`" class="recent-item">
          <span class="recent-text">
            <span class="recent-name">{{ scan.name }}</span>
            <span class="recent-code">{{ scan.code }}</span>
          </span>
          <a
            class="btn btn-small"
            :href="routes.collectionAdd(scan.cardId, scan.code)"
            :aria-label="`Ajouter ${scan.name} (${scan.code}) à ma collection`"
          >
            Ajouter
          </a>
        </li>
      </ul>
    </section>

    <ScanResultSheet
      v-if="sheet"
      :content="sheet"
      @resume="resume"
      @lookup="lookupCode"
      @pick="pickCard"
    />
  </section>
</template>

<style scoped>
.scan {
  display: grid;
  gap: var(--space-4);
  max-width: 40rem;
  margin-inline: auto;
  padding-bottom: var(--space-6);
  color: var(--color-text);
  font-family: var(--font-sans);
}

.intro h1 {
  margin: 0;
  font-size: var(--text-xl);
  line-height: 1.15;
}
.subtitle {
  margin: var(--space-1) 0 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
}

.notice {
  margin: 0;
  padding: var(--space-3) var(--space-4);
  border: 1px solid var(--color-accent);
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-accent) 12%, var(--color-surface));
}
.notice a {
  display: inline-block;
  margin-top: var(--space-1);
  color: var(--color-primary);
  font-weight: 600;
}

/* Contenus posés sur la vidéo (toujours sombre) : texte clair quel que soit le thème. */
.overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-3);
  padding: var(--space-5);
  text-align: center;
  color: #fff;
  background: rgb(5 7 11 / 0.55);
  backdrop-filter: blur(2px);
}
.overlay p {
  margin: 0;
  max-width: 22rem;
}
.overlay-error {
  font-weight: 600;
}

.instruction {
  position: absolute;
  top: var(--space-3);
  left: 50%;
  transform: translateX(-50%);
  margin: 0;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: rgb(5 7 11 / 0.6);
  color: #fff;
  font-size: var(--text-sm);
  white-space: nowrap;
}

.tools {
  position: absolute;
  right: var(--space-3);
  top: var(--space-3);
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

/* Déclencheur façon appareil photo, en bas au centre (zone du pouce). */
.shutter {
  position: absolute;
  left: 50%;
  bottom: var(--space-4);
  transform: translateX(-50%);
  display: grid;
  place-items: center;
  width: 4.25rem;
  height: 4.25rem;
  padding: 0;
  border: 4px solid #fff;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.shutter__ring {
  width: 3.1rem;
  height: 3.1rem;
  border-radius: 50%;
  background: #fff;
  transition: transform var(--transition-fast);
}
.shutter:active .shutter__ring {
  transform: scale(0.88);
}
.shutter:disabled {
  opacity: 0.5;
  cursor: default;
}
.shutter:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 3px;
}

/* Image figée : bandeau « Reprendre la caméra » en bas. */
.still-bar {
  position: absolute;
  inset: auto 0 0;
  display: flex;
  justify-content: center;
  padding: var(--space-3);
  background: linear-gradient(transparent, rgb(5 7 11 / 0.7));
}
.icon-btn {
  display: grid;
  place-items: center;
  width: 48px;
  height: 48px;
  border: 1px solid rgb(255 255 255 / 0.3);
  border-radius: var(--radius-pill);
  background: rgb(5 7 11 / 0.55);
  color: #fff;
  cursor: pointer;
  transition: background var(--transition-fast);
}
.icon-btn[aria-pressed='true'] {
  background: var(--color-accent);
  color: #111;
}
.icon-btn svg {
  width: 22px;
  height: 22px;
  fill: none;
  stroke: currentcolor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.icon-btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}

.engine {
  position: absolute;
  left: var(--space-3);
  right: var(--space-3);
  bottom: calc(var(--space-3) + 56px);
  display: grid;
  gap: var(--space-1);
  color: #fff;
  font-size: var(--text-sm);
  text-shadow: 0 1px 2px rgb(0 0 0 / 0.6);
}
.bar {
  height: 4px;
  border-radius: var(--radius-pill);
  background: rgb(255 255 255 / 0.25);
  overflow: hidden;
}
.bar-fill {
  display: block;
  height: 100%;
  background: var(--color-primary);
  transition: width 200ms linear;
}

.spinner {
  width: 2rem;
  height: 2rem;
  border: 3px solid rgb(255 255 255 / 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.9s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(1turn);
  }
}

.status {
  min-height: 1.5em;
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--text-sm);
  text-align: center;
}

.quick-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-2);
}
.hint {
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  font-size: var(--text-sm);
}

.manual,
.recent {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-4);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  background: var(--color-surface);
  box-shadow: var(--shadow-sm);
}
.section-title {
  margin: 0;
  font-size: var(--text-md);
}
.field-label {
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}
.manual-row {
  display: flex;
  gap: var(--space-2);
}
.field {
  flex: 1;
  min-width: 0;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-surface-2);
  color: var(--color-text);
  font: 600 var(--text-md) / 1 var(--font-mono);
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.field::placeholder {
  color: var(--color-text-muted);
  font-weight: 400;
  text-transform: none;
}
.field:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 1px;
}
.field-error {
  margin: 0;
  color: var(--color-danger);
  font-size: var(--text-sm);
}

.text-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: var(--color-primary);
}
.text-link:focus-visible,
.notice a:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.recent-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
}
.recent-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: var(--space-2);
  border-top: 1px solid var(--color-border);
}
.recent-item:first-child {
  border-top: 0;
}
.recent-text {
  display: grid;
  min-width: 0;
}
.recent-name {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-code {
  font-family: var(--font-mono);
  font-size: var(--text-sm);
  color: var(--color-text-muted);
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  min-width: 44px;
  padding: 0 var(--space-4);
  border: 1px solid transparent;
  border-radius: var(--radius-pill);
  font: 600 var(--text-md) / 1.2 var(--font-sans);
  text-decoration: none;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    transform var(--transition-fast);
}
.btn:active {
  transform: scale(0.98);
}
.btn:disabled {
  opacity: 0.6;
  cursor: progress;
}
.btn:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: 2px;
}
.btn-primary {
  background: var(--color-primary);
  color: var(--color-primary-contrast);
}
.btn-ghost {
  background: var(--color-surface);
  border-color: var(--color-border);
  color: var(--color-text);
}
.btn-glass {
  background: rgb(255 255 255 / 0.12);
  border-color: rgb(255 255 255 / 0.4);
  color: #fff;
}
.btn-small {
  flex: none;
  padding: 0 var(--space-3);
  background: var(--color-surface-2);
  border-color: var(--color-border);
  color: var(--color-text);
  font-size: var(--text-sm);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .spinner {
    animation-duration: 3s;
  }
  .bar-fill {
    transition: none;
  }
}
</style>
