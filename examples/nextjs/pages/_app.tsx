import type { AppProps } from 'next/app'
import '../styles/globals.css'
import { inspect } from '@xstate/inspect'
import Header from '../components/Header'

if (typeof window !== 'undefined' && process.env.NODE_ENV) {
  inspect({
    url: 'https://statecharts.io/inspect',
    iframe: false
  })
}

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <div>
      <Header />
      <Component {...pageProps} />
    </div>
  )
}

export default MyApp
