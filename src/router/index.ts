import { createRouter, createWebHashHistory } from 'vue-router'

// Historique « hash » (#/collection) : fonctionne sur un hébergement statique comme GitHub Pages
// sans configuration de réécriture d'URL. Doc : https://router.vuejs.org/guide/essentials/history-mode.html
export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      name: 'search',
      component: () => import('@/views/SearchView.vue'),
      meta: { title: 'Recherche' },
    },
    {
      path: '/collection',
      name: 'collection',
      component: () => import('@/views/CollectionView.vue'),
      meta: { title: 'Ma collection' },
    },
    {
      // Temporaire (avant la migration Astro) : page de scan, île Vue autonome.
      path: '/scan',
      name: 'scan',
      component: () => import('@/components/pages/ScanPage.vue'),
      meta: { title: 'Scanner' },
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue'),
      meta: { title: 'À propos' },
    },
  ],
})

router.afterEach((to) => {
  document.title = `${String(to.meta.title ?? '')} · Card Manager`
})
