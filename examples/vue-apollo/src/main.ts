import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { createVuetify, ThemeDefinition } from 'vuetify'

import { createApolloClient } from '@nhost/apollo'
import { NhostClient } from '@nhost/vue'
import { DefaultApolloClient } from '@vue/apollo-composable'
import { inspect } from '@xstate/inspect'

// eslint-disable-next-line import/no-unresolved
import 'vuetify/styles'

import App from './App.vue'
import EmailPasswordless from './components/EmailPasswordlessForm.vue'
import ErrorSnackBar from './components/ErrorSnackBar.vue'
import OauthLinks from './components/OAuthLinks.vue'
import VerificationEmailDialog from './components/VerificationEmailDialog.vue'
import OtpSentDialog from './components/OtpSentDialog.vue'
import { routes } from './routes'

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

const devTools = import.meta.env.VITE_DEBUG === 'true'
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN,
  region: import.meta.env.VITE_NHOST_REGION,
  devTools
})

const apolloClient = createApolloClient({ nhost })

// ? Make it part of @nhost/apollo?
nhost.auth.onAuthStateChanged((d) => {
  if (d === 'SIGNED_OUT') {
    console.log('clear store')
    apolloClient.clearStore()
  }
})

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to) => {
  const authenticated = await nhost.auth.isAuthenticatedAsync()
  if (!authenticated && to.meta.auth) {
    return '/signin'
  }
  return true
})

createApp(App)
  .provide(DefaultApolloClient, apolloClient)
  .use(router)
  .use(vuetify)
  .use(nhost)
  .component('ErrorSnackBar', ErrorSnackBar)
  .component('EmailPasswordless', EmailPasswordless)
  .component('OauthLinks', OauthLinks)
  .component('VerificationEmailDialog', VerificationEmailDialog)
  .component('OTPSentDialog', OtpSentDialog)
  .mount('#app')
