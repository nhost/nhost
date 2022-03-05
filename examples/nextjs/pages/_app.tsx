import type { AppProps } from 'next/app'
import React from 'react'

import { NhostSSR } from '@nhost/client'
import { NhostProvider } from '@nhost/react'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'

import Header from '../components/Header'
import { BACKEND_URL } from '../helpers'

import '../styles/globals.css'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_DEBUG) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}
const nhost = new NhostSSR({ backendUrl: BACKEND_URL })

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider>
        <div className="App">
          <Header />
          <Component {...pageProps} />
        </div>
      </NhostApolloProvider>
    </NhostProvider>
  )
}

export default MyApp
