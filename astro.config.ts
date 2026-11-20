import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'astro/config'
import vue from '@astrojs/vue'
import { AstroPWAIntegration } from '@vite-pwa/astro'

const IMAGES_ORIGIN = 'https://images.ygoprodeck.com'
const API_ORIGIN = 'https://db.ygoprodeck.com'

// Sur GitHub Pages, l'app est servie sous /<nom-du-dépôt>/ : le workflow de déploiement passe
// ce chemin via VITE_BASE. Doc : https://docs.astro.build/fr/guides/deploy/github/
const base = process.env.VITE_BASE ?? '/'

// https://docs.astro.build/fr/reference/configuration-reference/
export default defineConfig({
  site: 'https://happy4game.github.io',
  base,
  // Site 100 % statique (pas de serveur) : chaque page devient un fichier HTML dans dist/.
  output: 'static',
  // /collection/ et non /collection : même forme que src/lib/routes.ts et que GitHub Pages.
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Pas de Markdown dans ce projet : coloration Shiki désactivée (styles en ligne contraires à la CSP).
  markdown: { syntaxHighlight: false },
  integrations: [
    // Composants Vue en « îles » : Astro produit le HTML, Vue n'anime que les zones interactives.
    // `appEntrypoint` enregistre Pinia dans chaque île.
    // Doc : https://docs.astro.build/fr/guides/integrations-guide/vue/#appentrypoint
    vue({ appEntrypoint: '/src/pages/_app', devtools: true }),
    // PWA : manifeste + service worker Workbox. Doc : https://unplugin-pwa.netlify.app/frameworks/astro
    AstroPWAIntegration({
      registerType: 'autoUpdate',
      // On enregistre le service worker nous-mêmes (script du layout, compatible CSP).
      injectRegister: false,
      // Icônes et favicon déjà couverts par `globPatterns` : on évite les doublons du précache.
      includeAssets: [],
      includeManifestIcons: false,
      manifest: {
        name: 'Card Manager : ma collection',
        short_name: 'Card Manager',
        description:
          'Gérer sa collection de cartes chez soi, hors ligne. Projet libre et non officiel.',
        lang: 'fr',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#1e3a5f',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      generateSW: {
        // Les 4 pages HTML sont précachées : la navigation hors ligne fonctionne sur chacune.
        // (Le manifeste .webmanifest est ajouté au précache par le plugin lui-même.)
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Une URL inconnue hors ligne affiche la page d'accueil (Recherche).
        navigateFallback: base,
        // `?add=…&set=…` (lien « Ajouter à ma collection ») doit trouver /collection/ dans le cache.
        // Doc : https://developer.chrome.com/docs/workbox/modules/workbox-precaching#ignore_url_parameters
        ignoreURLParametersMatching: [/^utm_/, /^fbclid$/, /^add$/, /^set$/],
        runtimeCaching: [
          {
            // Images de cartes : téléchargées une seule fois puis servies depuis le cache,
            // comme le demande https://ygoprodeck.com/api-guide/.
            // Le serveur d'images n'envoie pas d'en-tête CORS : la réponse est « opaque »
            // (statut 0). Chrome compte chaque réponse opaque pour plusieurs Mo dans le quota,
            // d'où la limite d'entrées et la purge si le quota est atteint.
            // Doc : https://developer.chrome.com/docs/workbox/caching-resources-during-runtime#opaque_responses_and_the_storage_quota
            // Cette fonction est recopiée telle quelle dans sw.js : elle ne peut pas utiliser une
            // constante de ce fichier (elle n'existerait pas dans le service worker).
            urlPattern: ({ url }) => url.origin === 'https://images.ygoprodeck.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'card-images',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 365 * 24 * 60 * 60,
                purgeOnQuotaError: true,
              },
            },
          },
        ],
      },
    }),
  ],
  security: {
    // Content-Security-Policy en balise <meta>, générée au build : Astro calcule l'empreinte
    // (hash) de chacun de ses scripts en ligne. Inactive en développement (serveur Vite).
    // Doc : https://docs.astro.build/fr/reference/configuration-reference/#securitycsp
    // (frame-ancestors n'est pas pris en compte dans une balise meta, il faudrait un en-tête HTTP.)
    csp: {
      directives: [
        "default-src 'self'",
        `img-src 'self' data: blob: ${IMAGES_ORIGIN}`,
        `connect-src 'self' ${API_ORIGIN} ${IMAGES_ORIGIN}`,
        // blob: : workers créés par Tesseract.js (OCR du scan).
        "worker-src 'self' blob:",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ],
      scriptDirective: {
        // 'wasm-unsafe-eval' : autorise la compilation WebAssembly (moteur OCR Tesseract.js),
        // sans autoriser eval() en JavaScript.
        resources: ["'self'", "'wasm-unsafe-eval'"],
      },
      styleDirective: {
        // Les attributs style="" (Vue :style) exigent 'unsafe-inline' ; Astro n'ajoute alors
        // pas de hash sur style-src, ce qui revient au comportement précédent.
        resources: ["'self'", "'unsafe-inline'"],
      },
    },
  },
  vite: {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  },
})
