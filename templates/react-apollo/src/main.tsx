import { NhostClient, NhostProvider } from '@nhost/react'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

const nhost = new NhostClient({
  subdomain: 'local',
  region: undefined
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <NhostProvider nhost={nhost}>
      <StrictMode>
        <App />
      </StrictMode>
    </NhostProvider>
  </BrowserRouter>
)
