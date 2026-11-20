import { fileURLToPath, URL } from 'node:url'

import { defineConfig, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

const IMAGES_ORIGIN = 'https://images.ygoprodeck.com'
const API_ORIGIN = 'https://db.ygoprodeck.com'

/**
 * Content-Security-Policy ajoutée seulement au build : en développement, Vite injecte des
 * scripts et une connexion WebSocket que cette politique bloquerait.
 * Doc MDN : https://developer.mozilla.org/fr/docs/Web/HTTP/CSP
 * (frame-ancestors n'est pas pris en compte dans une balise meta, il faudrait un en-tête HTTP.)
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  // Vue n'injecte pas de style en production, mais les attributs style="" restent possibles.
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${IMAGES_ORIGIN}`,
  `connect-src 'self' ${API_ORIGIN} ${IMAGES_ORIGIN}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

function contentSecurityPolicy(): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY },
        injectTo: 'head-prepend',
      },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
    contentSecurityPolicy(),
    // PWA : manifeste + service worker Workbox. Doc : https://vite-pwa-org.netlify.app/guide/
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/apple-touch-icon.png', 'icons/icon.svg'],
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
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            // Images de cartes : téléchargées une seule fois puis servies depuis le cache,
            // comme le demande https://ygoprodeck.com/api-guide/.
            // Le serveur d'images n'envoie pas d'en-tête CORS : la réponse est « opaque »
            // (statut 0). Chrome compte chaque réponse opaque pour plusieurs Mo dans le quota,
            // d'où la limite d'entrées et la purge si le quota est atteint.
            // Doc : https://developer.chrome.com/docs/workbox/caching-resources-during-runtime#opaque_responses_and_the_storage_quota
            urlPattern: ({ url }) => url.origin === IMAGES_ORIGIN,
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
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
