import { createRoot } from 'react-dom/client'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'

import { NhostClient, NhostReactProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'

import 'rsuite/styles/index.less' // or 'rsuite/dist/rsuite.min.css'

import App from './App'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337'
})

if (import.meta.env.VITE_DEBUG) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const container = document.getElementById('root')
const root = createRoot(container!)
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <NhostReactProvider nhost={nhost}>
        <NhostApolloProvider nhost={nhost}>
          <App />
        </NhostApolloProvider>
      </NhostReactProvider>
    </BrowserRouter>
  </React.StrictMode>
)
