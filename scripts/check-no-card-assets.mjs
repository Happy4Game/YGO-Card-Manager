// Garde-fou légal : refuse tout fichier qui ressemble à un asset de cartes Konami.
// Règle du projet (README) : aucune image ni donnée de carte n'est versionnée.
//
// - Images autorisées seulement dans public/icons/ (icônes originales) et public/favicon.ico.
// - Aucun fichier JSON de plus de 200 Ko hors package-lock.json (un export de cartes en ferait des Mo).
//
// Usage : node scripts/check-no-card-assets.mjs
import { execFileSync } from 'node:child_process'
import { statSync } from 'node:fs'

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp|ico|svg)$/i
const ALLOWED_IMAGE = (path) => path.startsWith('public/icons/') || path === 'public/favicon.ico'
const MAX_JSON_BYTES = 200 * 1024

const files = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean)
const problems = []

for (const path of files) {
  if (IMAGE.test(path) && !ALLOWED_IMAGE(path)) {
    problems.push(`${path} : image hors de public/icons/`)
  }
  if (path.endsWith('.json') && path !== 'package-lock.json') {
    const size = statSync(path).size
    if (size > MAX_JSON_BYTES) problems.push(`${path} : JSON de ${size} octets (> 200 Ko)`)
  }
}

if (problems.length > 0) {
  console.error('Fichiers refusés (voir CONTRIBUTING.md, règles légales) :')
  for (const problem of problems) console.error(`- ${problem}`)
  process.exit(1)
}
console.log(`OK : ${files.length} fichiers vérifiés, aucun asset de cartes.`)
