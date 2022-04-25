import { Quasar } from 'quasar'
import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'

import { NhostClient } from '@nhost/vue'
import { inspect } from '@xstate/inspect'

import 'quasar/src/css/index.sass'

import Index from './pages/Index.vue'
import App from './App.vue'

// Import icon libraries
import '@quasar/extras/material-icons/material-icons.css'

const devTools = !!import.meta.env.VITE_DEBUG
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: '/', component: Index }]
})

export const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337',
  refreshIntervalTime: 10,
  devTools
})

createApp(App).use(router).use(Quasar).mount('#app')
