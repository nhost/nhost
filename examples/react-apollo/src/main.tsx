import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { NhostProvider } from '@nhost/react'
import { NhostClient } from '@nhost/core'

import { inspect } from '@xstate/inspect'

if (process.env.NODE_ENV) {
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false
  })
}

const nhost = new NhostClient({
  backendUrl: 'http://localhost:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider>
        <App />
      </NhostApolloProvider>
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
