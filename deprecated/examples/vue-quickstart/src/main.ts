import { createApolloClient } from '@nhost/apollo'
import { NhostClient } from '@nhost/vue'
import { DefaultApolloClient } from '@vue/apollo-composable'
import routes from 'virtual:generated-pages'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'

import '@unocss/reset/tailwind.css?inline'
import 'uno.css?inline'
import './styles/main.css?inline'

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN,
  region: import.meta.env.VITE_NHOST_REGION
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
