import React from 'react'
import ReactDOM from 'react-dom'
import './index.css'
import App from './App'
import { NhostProvider } from './react-auth'
import { createNhostMachine } from './state'

const machine = createNhostMachine({
  endpoint: 'http://127.0.0.1:1337'
})

ReactDOM.render(
  <React.StrictMode>
    <NhostProvider machine={machine}>
      <App />
    </NhostProvider>
  </React.StrictMode>,
  document.getElementById('root')
)
