// Spike phase 1 : vérifier ce que l'API YGOPRODeck permet depuis un navigateur.
//
// Ce script fait exactement 3 requêtes (bien sous la limite de 20 req/s du guide
// officiel : https://ygoprodeck.com/api-guide/) et n'enregistre aucune donnée.
//
// Usage : node scripts/spike-ygoprodeck.mjs
//
// Ce qu'il mesure :
// 1. CORS : un navigateur n'autorise une page à lire une réponse d'un autre domaine
//    que si le serveur renvoie l'en-tête Access-Control-Allow-Origin.
//    Référence : https://developer.mozilla.org/fr/docs/Web/HTTP/CORS
//    On simule une page en envoyant un en-tête Origin.
// 2. La version de la base (checkDBVer) pour savoir quand resynchroniser.
// 3. La taille de la liste complète des cartes en français, pour savoir si elle
//    tient confortablement dans IndexedDB sur un téléphone.

const ORIGIN = 'https://example.github.io'
const API = 'https://db.ygoprodeck.com/api/v7'
// Une image d'exemple, téléchargée une seule fois (on lit seulement les en-têtes).
const IMAGE = 'https://images.ygoprodeck.com/images/cards_small/6983839.jpg'

async function probe(label, url) {
  const started = performance.now()
  const res = await fetch(url, { headers: { Origin: ORIGIN } })
  const body = await res.arrayBuffer()
  const ms = Math.round(performance.now() - started)
  console.log(`\n## ${label}`)
  console.log(`URL : ${url}`)
  console.log(`Statut HTTP : ${res.status}`)
  console.log(
    `Access-Control-Allow-Origin : ${res.headers.get('access-control-allow-origin') ?? '(absent)'}`,
  )
  console.log(`Content-Type : ${res.headers.get('content-type')}`)
  console.log(`Cache-Control : ${res.headers.get('cache-control') ?? '(absent)'}`)
  console.log(`Taille reçue : ${(body.byteLength / 1024 / 1024).toFixed(2)} Mo, en ${ms} ms`)
  return { res, body }
}

const { body: verBody } = await probe('Version de la base', `${API}/checkDBVer.php`)
console.log(`Réponse : ${new TextDecoder().decode(verBody)}`)

const { body: allBody } = await probe(
  'Toutes les cartes en français',
  `${API}/cardinfo.php?language=fr`,
)
try {
  const json = JSON.parse(new TextDecoder().decode(allBody))
  console.log(`Nombre de cartes : ${json.data?.length ?? '(inconnu)'}`)
} catch {
  console.log('La réponse n’est pas du JSON valide.')
}

await probe('Image (petite)', IMAGE)
