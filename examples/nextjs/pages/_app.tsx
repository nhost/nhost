import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { inspect } from '@xstate/inspect'
import Header from '../components/Header'
import { initNhost } from '@nhost/core'
import { NhostProvider } from '@nhost/react'

if (typeof window !== 'undefined' && process.env.NODE_ENV) {
  console.log('inspect??')
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false
  })
}

export const nhost = initNhost({
  backendUrl: 'http://127.0.0.1:1337',
  ssr: true
})

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <NhostProvider nhost={nhost}>
      {/*>
        <NhostApolloProvider> */}
      {/* <ApolloProvider client={client}> */}
      <Header />
      <Component {...pageProps} />
      {/* </ApolloProvider> */}
      {/* </NhostApolloProvider>*/}
    </NhostProvider>
  )
}
