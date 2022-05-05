import { createRoot } from 'react-dom/client'
import React from 'react'
import { BrowserRouter } from 'react-router-dom'

import { NhostClient, NhostReactProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'

import 'rsuite/styles/index.less' // or 'rsuite/dist/rsuite.min.css'

import App from './App'

const devTools = !!import.meta.env.VITE_DEBUG
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337',
  devTools
})

const container = document.getElementById('root')
const root = createRoot(container!)
root.render(
  // * See https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-strict-mode
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
