import { NhostClient, NhostProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

const devTools = import.meta.env.MODE === 'development' && import.meta.env.VITE_DEBUG === 'true'
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}

const nhost = new NhostClient({
  subdomain: import.meta.env.VITE_NHOST_SUBDOMAIN || 'localhost',
  region: import.meta.env.VITE_NHOST_REGION,
  devTools
})

const container = document.getElementById('root')
const root = createRoot(container!)
root.render(
  // * See https://reactjs.org/blog/2022/03/08/react-18-upgrade-guide.html#updates-to-strict-mode
  // * The xstate inspector is hard to use with React 18 strict mode
  // <React.StrictMode>
  <BrowserRouter>
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <App />
      </NhostApolloProvider>
    </NhostProvider>
  </BrowserRouter>
  // </React.StrictMode>
)
