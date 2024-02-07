import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { NhostProvider, NhostSession } from '@nhost/nextjs'
import { NhostApolloProvider } from '@nhost/react-apollo'

import { nhost } from '../nhost'

type Props = {
  nhostSession?: NhostSession
}

export default function App({ Component, pageProps }: AppProps<Props>) {
  return (
    <NhostProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider nhost={nhost}>
        <Component {...pageProps} />
      </NhostApolloProvider>
    </NhostProvider>
  )
}
