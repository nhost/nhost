import React from 'react'
import ReactDOM from 'react-dom'
import App from './App'
import { NhostApolloProvider } from './react-apollo'
import { NhostProvider } from './react-auth'
import { createNhostMachine } from './state'

const machine = createNhostMachine({
  endpoint: 'http://127.0.0.1:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider machine={machine} nhostUrl={'http://127.0.0.1:1337'}>
      <NhostApolloProvider>
        <App />
      </NhostApolloProvider>
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
