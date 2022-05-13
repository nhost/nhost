/* eslint-disable @typescript-eslint/comma-dangle */
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import { NhostClient } from '@nhost/vue'
import App from './App.vue'

import '@unocss/reset/tailwind.css'
import './styles/main.css'
import 'uno.css'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL
})

const app = createApp(App)
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})
app.use(router).use(nhost)
app.mount('#app')
