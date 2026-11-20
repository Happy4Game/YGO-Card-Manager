import type Tesseract from 'tesseract.js'

/**
 * Lecteur OCR embarqué : Tesseract.js (moteur Tesseract compilé en WebAssembly), exécuté dans un
 * Web Worker pour ne pas figer l'interface. Tout se passe sur l'appareil : aucune image
 * n'est envoyée sur Internet.
 * Doc : https://github.com/naptha/tesseract.js/blob/master/docs/api.md
 *
 * Les fichiers (worker, moteur WASM, données de langue) sont servis par l'application
 * elle-même depuis /tesseract/ (copiés au build par scripts/copy-tesseract-assets.mjs) :
 * pas de CDN, compatible avec la CSP et le mode hors ligne. Les données de langue sont
 * ensuite gardées en cache dans IndexedDB par Tesseract.js.
 */

export interface OcrReading {
  text: string
  /** Confiance moyenne annoncée par Tesseract (0 à 100). */
  confidence: number
}

export interface OcrProgress {
  /** Avancement global de 0 à 1. */
  progress: number
  /** Étape en français, pour l'affichage. */
  label: string
}

/** Image acceptée par le moteur (un canvas, préparé par imageProcessing). */
export type OcrImage = HTMLCanvasElement

export interface OcrEngine {
  /** Lit une ligne de code d'impression (lettres majuscules, chiffres et tiret uniquement). */
  readCode(image: OcrImage): Promise<OcrReading>
  /** Lit du texte épars (zone large, ex. bas d'une carte Pendule ou photo importée). */
  readSparse(image: OcrImage): Promise<OcrReading>
  /** Lit le nom de la carte (français + anglais, accents compris). */
  readName(image: OcrImage, onProgress?: (progress: OcrProgress) => void): Promise<OcrReading>
  terminate(): Promise<void>
}

export const CODE_WHITELIST = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'

type TesseractModule = typeof Tesseract

/** Variante du moteur WASM adaptée au navigateur (instructions SIMD : bien plus rapide). */
export type CoreVariant = 'relaxedsimd-lstm' | 'simd-lstm' | 'lstm'

/**
 * Chemins des fichiers auto-hébergés (BASE_URL : « / » en local, « /<dépôt>/ » sur Pages).
 * Le moteur est nommé en .mjs (voir scripts/copy-tesseract-assets.mjs) : on désigne donc le
 * fichier exact au lieu de laisser Tesseract.js deviner son nom dans un dossier.
 */
export function tesseractPaths(variant: CoreVariant, baseUrl: string = import.meta.env.BASE_URL) {
  const base = `${baseUrl.replace(/\/?$/, '/')}tesseract/`
  return {
    workerPath: `${base}worker.min.js`,
    corePath: `${base}core/tesseract-core-${variant}.wasm.mjs`,
    langPath: `${base}lang`,
  }
}

/**
 * Détecte le SIMD WebAssembly, comme le fait Tesseract.js en interne (même bibliothèque).
 * Doc : https://github.com/GoogleChromeLabs/wasm-feature-detect
 */
export async function detectCoreVariant(): Promise<CoreVariant> {
  const { relaxedSimd, simd } = await import('wasm-feature-detect')
  if (await relaxedSimd()) return 'relaxedsimd-lstm'
  if (await simd()) return 'simd-lstm'
  return 'lstm'
}

/** Chargement différé : le code de Tesseract.js n'est téléchargé que sur la page de scan. */
async function loadTesseract(): Promise<TesseractModule> {
  const module = await import('tesseract.js')
  // Paquet CommonJS : selon l'outil, les fonctions sont sur l'export par défaut ou à la racine.
  return 'default' in module && typeof module.default?.createWorker === 'function'
    ? module.default
    : module
}

const STEP_LABELS: Record<string, string> = {
  'loading tesseract core': 'chargement du moteur',
  'initializing tesseract': 'démarrage du moteur',
  'loading language traineddata': 'chargement des données de langue',
  'loaded language traineddata': 'données de langue prêtes',
  'initializing api': 'initialisation',
  'initialized api': 'prêt',
}

/** Poids de chaque étape dans la barre de progression globale (les téléchargements dominent). */
const STEP_RANGES: Record<string, [number, number]> = {
  'loading tesseract core': [0, 0.5],
  'initializing tesseract': [0.5, 0.55],
  'loading language traineddata': [0.55, 0.9],
  'loaded language traineddata': [0.9, 0.92],
  'initializing api': [0.92, 1],
  'initialized api': [1, 1],
}

/** Convertit un message de Tesseract.js en avancement global (0–1) et libellé français. */
export function toOcrProgress(status: string, progress: number): OcrProgress | undefined {
  const range = STEP_RANGES[status]
  if (!range) return undefined
  const [start, end] = range
  const clamped = Math.min(1, Math.max(0, progress))
  return { progress: start + (end - start) * clamped, label: STEP_LABELS[status] ?? status }
}

async function spawn(
  tesseract: TesseractModule,
  variant: CoreVariant,
  langs: string,
  onProgress: ((progress: OcrProgress) => void) | undefined,
  config?: Partial<Tesseract.InitOptions>,
): Promise<Tesseract.Worker> {
  return tesseract.createWorker(
    langs,
    tesseract.OEM.LSTM_ONLY,
    {
      ...tesseractPaths(variant),
      // Sans URL « blob: » : le worker est chargé directement depuis notre origine, ce qui
      // évite d'ajouter « blob: » à la directive worker-src de la CSP.
      workerBlobURL: false,
      logger: (message) => {
        const progress = toOcrProgress(message.status, message.progress)
        if (progress) onProgress?.(progress)
      },
      errorHandler: (error: unknown) => console.error('[ocr]', error),
    },
    config,
  )
}

const toReading = (result: Tesseract.RecognizeResult): OcrReading => ({
  text: result.data.text,
  confidence: result.data.confidence,
})

export async function createOcrEngine(
  onProgress?: (progress: OcrProgress) => void,
): Promise<OcrEngine> {
  const [tesseract, variant] = await Promise.all([loadTesseract(), detectCoreVariant()])
  // Pas de dictionnaire pour les codes : « LOB-FR001 » n'est pas un mot anglais.
  // Ces options ne se règlent qu'à l'initialisation (4e argument de createWorker).
  const codeWorker = await spawn(tesseract, variant, 'eng', onProgress, {
    load_system_dawg: '0',
    load_freq_dawg: '0',
  })
  let codeMode: 'line' | 'sparse' | undefined
  let nameWorker: Promise<Tesseract.Worker> | undefined
  // Un worker ne traite qu'une image à la fois : on enchaîne les demandes.
  let queue: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task, task)
    queue = run.catch(() => undefined)
    return run
  }

  // Paramètres Tesseract : https://tesseract-ocr.github.io/tessdoc/ImproveQuality.html#page-segmentation-method
  const useCodeMode = async (mode: 'line' | 'sparse') => {
    if (codeMode === mode) return
    await codeWorker.setParameters({
      tessedit_char_whitelist: CODE_WHITELIST,
      tessedit_pageseg_mode:
        mode === 'line' ? tesseract.PSM.SINGLE_LINE : tesseract.PSM.SPARSE_TEXT,
    })
    codeMode = mode
  }

  return {
    readCode: (image) =>
      serial(async () => {
        await useCodeMode('line')
        return toReading(await codeWorker.recognize(image))
      }),
    readSparse: (image) =>
      serial(async () => {
        await useCodeMode('sparse')
        return toReading(await codeWorker.recognize(image))
      }),
    readName: (image, nameProgress) =>
      serial(async () => {
        nameWorker ??= spawn(tesseract, variant, 'fra+eng', nameProgress).then(
          async (worker) => {
            await worker.setParameters({ tessedit_pageseg_mode: tesseract.PSM.SINGLE_LINE })
            return worker
          },
          (error: unknown) => {
            // Échec (réseau coupé au premier chargement…) : on pourra réessayer plus tard.
            nameWorker = undefined
            throw error
          },
        )
        const worker = await nameWorker
        return toReading(await worker.recognize(image))
      }),
    async terminate() {
      await codeWorker.terminate()
      if (nameWorker) await (await nameWorker).terminate()
    },
  }
}
