import type { AppProps } from 'next/app'

import { inspect } from '@xstate/inspect'

import Header from '../components/Header'

import '../styles/globals.css'

if (typeof window !== 'undefined' && process.env.NODE_ENV) {
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false
  })
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div className="App">
      <Header />
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp
