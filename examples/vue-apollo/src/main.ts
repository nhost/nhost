import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createVuetify, ThemeDefinition } from 'vuetify'

import { NhostClient } from '@nhost/vue'
import { inspect } from '@xstate/inspect'

// eslint-disable-next-line import/no-unresolved
import 'vuetify/styles'

import EmailPasswordless from './components/EmailPasswordlessForm.vue'
import ErrorSnackBar from './components/ErrorSnackBar.vue'
import OauthLinks from './components/OAuthLinks.vue'
import App from './App.vue'
import routes from './routes'

import '@mdi/font/css/materialdesignicons.css'

const customLightTheme: ThemeDefinition = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#2b82ff',
    'primary-darken-1': '#3700B3',
    secondary: '#03DAC6',
    'secondary-darken-1': '#018786',
    error: '#B00020',
    info: '#2196F3',
    success: '#4CAF50',
    warning: '#FB8C00'
  }
}

const vuetify = createVuetify({
  theme: {
    defaultTheme: 'customLightTheme',
    themes: {
      customLightTheme
    }
  }
})
// https://vuetifyjs.com/en/introduction/why-vuetify/#feature-guides

const devTools = !!import.meta.env.VITE_DEBUG
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

export const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337',
  devTools
})

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

router.beforeEach(async (to, from) => {
  const authenticated = await nhost.auth.isAuthenticatedAsync()
  console.log('auth?', authenticated)
  if (!authenticated && to.meta.auth) {
    return '/signin'
  }
  return true
})

createApp(App)
  .use(router)
  .use(vuetify)
  .use(nhost)
  .component('ErrorSnackBar', ErrorSnackBar)
  .component('EmailPasswordless', EmailPasswordless)
  .component('OauthLinks', OauthLinks)
  .mount('#app')
