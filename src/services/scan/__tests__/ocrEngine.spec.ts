import { beforeEach, describe, expect, it, vi } from 'vitest'

// Pas de WebAssembly ni de Worker dans Vitest : Tesseract.js est remplacé par un faux module.
// Doc : https://vitest.dev/api/vi.html#vi-mock
const fake = vi.hoisted(() => {
  const workers: {
    langs: string
    options: Record<string, unknown>
    config: unknown
    setParameters: ReturnType<typeof vi.fn>
    recognize: ReturnType<typeof vi.fn>
    terminate: ReturnType<typeof vi.fn>
  }[] = []
  const createWorker = vi.fn(
    async (
      langs: string,
      _oem: number,
      options: Record<string, unknown> & {
        logger?: (message: { status: string; progress: number }) => void
      },
      config?: unknown,
    ) => {
      options.logger?.({ status: 'loading tesseract core', progress: 1 })
      options.logger?.({ status: 'initialized api', progress: 1 })
      const worker = {
        langs,
        options,
        config,
        setParameters: vi.fn(() => Promise.resolve({})),
        recognize: vi.fn(() =>
          Promise.resolve({
            data: { text: langs === 'eng' ? 'TST-FR001\n' : 'Dragon de Test', confidence: 91 },
          }),
        ),
        terminate: vi.fn(() => Promise.resolve({})),
      }
      workers.push(worker)
      return worker
    },
  )
  return { workers, createWorker }
})

vi.mock('tesseract.js', () => ({
  default: {
    createWorker: fake.createWorker,
    OEM: { LSTM_ONLY: 1 },
    PSM: { SINGLE_LINE: '7', SPARSE_TEXT: '11' },
  },
}))

const features = vi.hoisted(() => ({ relaxed: false, simd: true }))
vi.mock('wasm-feature-detect', () => ({
  relaxedSimd: () => Promise.resolve(features.relaxed),
  simd: () => Promise.resolve(features.simd),
}))

const { CODE_WHITELIST, createOcrEngine, detectCoreVariant, tesseractPaths, toOcrProgress } =
  await import('../ocrEngine')

const canvas = () => document.createElement('canvas')

describe('tesseractPaths', () => {
  it('pointe vers les fichiers auto-hébergés sous BASE_URL', () => {
    expect(tesseractPaths('simd-lstm', '/')).toEqual({
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/core/tesseract-core-simd-lstm.wasm.mjs',
      langPath: '/tesseract/lang',
    })
    expect(tesseractPaths('lstm', '/YGO-Card-Manager').workerPath).toBe(
      '/YGO-Card-Manager/tesseract/worker.min.js',
    )
  })
})

describe('detectCoreVariant', () => {
  it('choisit le moteur le plus rapide disponible', async () => {
    Object.assign(features, { relaxed: true, simd: true })
    expect(await detectCoreVariant()).toBe('relaxedsimd-lstm')
    Object.assign(features, { relaxed: false, simd: false })
    expect(await detectCoreVariant()).toBe('lstm')
    Object.assign(features, { relaxed: false, simd: true })
    expect(await detectCoreVariant()).toBe('simd-lstm')
  })
})

describe('toOcrProgress', () => {
  it('convertit les étapes en avancement global croissant', () => {
    const core = toOcrProgress('loading tesseract core', 0.5)
    const lang = toOcrProgress('loading language traineddata', 0.5)
    expect(core?.progress).toBeCloseTo(0.25)
    expect(lang?.progress).toBeGreaterThan(core?.progress ?? 1)
    expect(toOcrProgress('initialized api', 1)?.progress).toBe(1)
    expect(toOcrProgress('recognizing text', 0.5)).toBeUndefined()
  })
})

describe('createOcrEngine', () => {
  beforeEach(() => {
    fake.workers.length = 0
    fake.createWorker.mockClear()
  })

  it('démarre un worker anglais sans CDN ni URL blob, et suit la progression', async () => {
    const progress = vi.fn()
    await createOcrEngine(progress)
    const [worker] = fake.workers
    expect(worker?.langs).toBe('eng')
    expect(worker?.options).toMatchObject({
      workerPath: '/tesseract/worker.min.js',
      corePath: '/tesseract/core/tesseract-core-simd-lstm.wasm.mjs',
      langPath: '/tesseract/lang',
      workerBlobURL: false,
    })
    expect(worker?.config).toEqual({ load_system_dawg: '0', load_freq_dawg: '0' })
    expect(progress).toHaveBeenLastCalledWith({ progress: 1, label: 'prêt' })
  })

  it('lit un code en mode ligne unique avec la liste blanche A-Z, 0-9 et tiret', async () => {
    const engine = await createOcrEngine()
    const reading = await engine.readCode(canvas())
    expect(reading).toEqual({ text: 'TST-FR001\n', confidence: 91 })
    const worker = fake.workers[0]
    expect(worker?.setParameters).toHaveBeenCalledWith({
      tessedit_char_whitelist: CODE_WHITELIST,
      tessedit_pageseg_mode: '7',
    })
    // Même mode : les paramètres ne sont pas renvoyés à chaque image.
    await engine.readCode(canvas())
    expect(worker?.setParameters).toHaveBeenCalledTimes(1)
    await engine.readSparse(canvas())
    expect(worker?.setParameters).toHaveBeenLastCalledWith({
      tessedit_char_whitelist: CODE_WHITELIST,
      tessedit_pageseg_mode: '11',
    })
  })

  it('charge le français à la demande pour le nom, une seule fois', async () => {
    const engine = await createOcrEngine()
    expect(fake.workers).toHaveLength(1)
    expect((await engine.readName(canvas())).text).toBe('Dragon de Test')
    await engine.readName(canvas())
    expect(fake.workers).toHaveLength(2)
    expect(fake.workers[1]?.langs).toBe('fra+eng')
    await engine.terminate()
    expect(fake.workers.every((worker) => worker.terminate.mock.calls.length === 1)).toBe(true)
  })

  it('traite les images une par une', async () => {
    const engine = await createOcrEngine()
    const worker = fake.workers[0]
    let active = 0
    let maxActive = 0
    worker?.recognize.mockImplementation(async () => {
      active += 1
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
      return { data: { text: '', confidence: 0 } }
    })
    await Promise.all([
      engine.readCode(canvas()),
      engine.readCode(canvas()),
      engine.readSparse(canvas()),
    ])
    expect(maxActive).toBe(1)
  })
})
