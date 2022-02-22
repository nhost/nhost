import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { NhostProvider } from '@nhost/react'
import { Nhost } from '@nhost/client'

import { inspect } from '@xstate/inspect'

if (process.env.NODE_ENV) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const nhost = new Nhost({
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
