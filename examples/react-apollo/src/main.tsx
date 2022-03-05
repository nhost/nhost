import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { NhostProvider } from '@nhost/react'
import { Nhost } from '@nhost/client'
import 'rsuite/styles/index.less' // or 'rsuite/dist/rsuite.min.css'

import { BrowserRouter } from 'react-router-dom'
import { NhostApolloProvider } from '@nhost/react-apollo'

const nhost = new Nhost({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <NhostProvider nhost={nhost}>
        <NhostApolloProvider>
          <App />
        </NhostApolloProvider>
      </NhostProvider>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
