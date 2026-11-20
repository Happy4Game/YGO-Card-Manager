import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { requestPersistence } from './services/storagePersistence'

createApp(App).use(createPinia()).use(router).mount('#app')

// La collection n'existe que sur cet appareil : on demande au navigateur de ne pas l'effacer.
void requestPersistence()
