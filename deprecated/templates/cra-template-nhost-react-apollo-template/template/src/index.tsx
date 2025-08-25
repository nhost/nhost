import React from 'react'
import ReactDOM from 'react-dom/client'
import { NhostClient, NhostProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { TooltipProvider } from '@/components/ui/tooltip'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import App from './App'
import './index.css'

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)
const nhost = new NhostClient({ subdomain: '<subdomain>', region: '<region>' })

root.render(
  <React.StrictMode>
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <TooltipProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </NhostApolloProvider>
    </NhostProvider>
  </React.StrictMode>
)
