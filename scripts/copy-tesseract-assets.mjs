// Copie les fichiers du lecteur OCR (Tesseract.js) depuis node_modules vers public/tesseract/,
// pour les servir depuis notre propre origine : pas de CDN, fonctionne hors ligne et avec une
// CSP stricte. Ces binaires (WASM, données de langue) ne sont PAS versionnés (voir .gitignore).
//
// Doc Tesseract.js (héberger soi-même les fichiers) :
// https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md
//
// Usage : node scripts/copy-tesseract-assets.mjs (lancé automatiquement par predev / prebuild-only)
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'tesseract')

/** Dossier d'un paquet npm installé (via son package.json). */
const pkgDir = (name) => dirname(require.resolve(`${name}/package.json`))

const tesseractJs = pkgDir('tesseract.js')
const core = pkgDir('tesseract.js-core')
const eng = pkgDir('@tesseract.js-data/eng')
const fra = pkgDir('@tesseract.js-data/fra')

// Moteur : trois variantes selon le navigateur (sans SIMD, SIMD, relaxed SIMD), choisie par
// l'application (src/services/scan/ocrEngine.ts). On n'utilise que le moteur LSTM (OEM 1) :
// les variantes « -lstm » suffisent. Chaque « .wasm.js » contient le WASM intégré (~3,9 Mo).
// Extension .mjs : le service worker (Workbox) précache tous les *.js et refuse les fichiers
// de plus de 2 Mo ; ces fichiers restent du JavaScript classique, chargé par importScripts.
const files = [
  [join(tesseractJs, 'dist', 'worker.min.js'), 'worker.min.js'],
  [join(tesseractJs, 'LICENSE.md'), 'LICENSE-tesseract.js.txt'],
  [join(core, 'tesseract-core-lstm.wasm.js'), 'core/tesseract-core-lstm.wasm.mjs'],
  [join(core, 'tesseract-core-simd-lstm.wasm.js'), 'core/tesseract-core-simd-lstm.wasm.mjs'],
  [
    join(core, 'tesseract-core-relaxedsimd-lstm.wasm.js'),
    'core/tesseract-core-relaxedsimd-lstm.wasm.mjs',
  ],
  [join(core, 'LICENSE'), 'LICENSE-tesseract.js-core.txt'],
  // Modèles « best_int » (LSTM, entiers) : bien plus légers que les modèles complets.
  // Ils proviennent de https://github.com/tesseract-ocr/tessdata_best (Apache-2.0).
  [join(eng, '4.0.0_best_int', 'eng.traineddata.gz'), 'lang/eng.traineddata.gz'],
  [join(fra, '4.0.0_best_int', 'fra.traineddata.gz'), 'lang/fra.traineddata.gz'],
]

let copied = 0
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`Fichier OCR introuvable : ${from} (lance « npm install »)`)
    process.exit(1)
  }
  const target = join(out, to)
  // Déjà à jour (même taille, plus récent) : on évite de recopier des Mo à chaque lancement.
  if (existsSync(target)) {
    const [source, existing] = [statSync(from), statSync(target)]
    if (source.size === existing.size && existing.mtimeMs >= source.mtimeMs) continue
  }
  mkdirSync(dirname(target), { recursive: true })
  copyFileSync(from, target)
  copied += 1
}
console.log(
  `Lecteur OCR : ${copied} fichier(s) copié(s) dans public/tesseract/ (${files.length} au total).`,
)
