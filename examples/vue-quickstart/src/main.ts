/* eslint-disable @typescript-eslint/comma-dangle,curly */
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import routes from 'virtual:generated-pages'
import { NhostClient } from '@nhost/vue'
import { createApolloClient } from '@nhost/apollo'
import { DefaultApolloClient } from '@vue/apollo-composable'
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

router.beforeEach(async (to) => {
  if (to.path === '/profile' && !(await nhost.auth.isAuthenticatedAsync())) {
    return '/sign-in'
  }
  return true
})

const apolloClient = createApolloClient({ nhost })

app.use(router).use(nhost).provide(DefaultApolloClient, apolloClient)
app.mount('#app')
