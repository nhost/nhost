import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { NhostClient, NhostReactProvider } from '@nhost/react'
import 'rsuite/styles/index.less' // or 'rsuite/dist/rsuite.min.css'

import { BrowserRouter } from 'react-router-dom'
import { NhostApolloProvider } from '@nhost/react-apollo'

const nhost = new NhostClient({
  backendUrl: import.meta.env.VITE_NHOST_URL || 'http://localhost:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <BrowserRouter>
      <NhostReactProvider nhost={nhost}>
        <NhostApolloProvider>
          <App />
        </NhostApolloProvider>
      </NhostReactProvider>
    </BrowserRouter>
  </React.StrictMode>,
  document.getElementById('root')
)
