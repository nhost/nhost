import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter } from 'react-router-dom'

import { NhostClient, NhostReactProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'

import 'rsuite/styles/index.less' // or 'rsuite/dist/rsuite.min.css'

import App from './App'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <NhostReactProvider nhost={nhost}>
        <NhostApolloProvider nhost={nhost}>
          <App />
        </NhostApolloProvider>
      </NhostReactProvider>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
