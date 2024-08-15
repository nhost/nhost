import { NhostClient, NhostProvider } from '@nhost/react'
import { StrictMode } from 'react'
import * as ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { Toaster } from './components/ui/sonner'
import { TooltipProvider } from './components/ui/tooltip'
import './styles/globals.css'

const nhost = new NhostClient({ subdomain: 'local' })

ReactDOM.createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <NhostProvider nhost={nhost}>
      <StrictMode>
        <TooltipProvider>
          <App />
        </TooltipProvider>
        <Toaster />
      </StrictMode>
    </NhostProvider>
  </BrowserRouter>
)
