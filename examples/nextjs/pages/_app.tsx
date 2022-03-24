import type { AppProps } from 'next/app'
import React from 'react'

import { NhostClient, NhostNextProvider } from '@nhost/nextjs'
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
const nhost = new NhostClient({ backendUrl: BACKEND_URL })

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostNextProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider nhost={nhost}>
        <div className="App">
          <Header />
          <Component {...pageProps} />
        </div>
      </NhostApolloProvider>
    </NhostNextProvider>
  )
}

export default MyApp
