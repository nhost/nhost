import { ChakraProvider } from '@chakra-ui/react'
import { auth } from '@libs/nhost'
import { NhostAuthProvider } from '@nhost/react-auth'
import customTheme from '@theme/customTheme'
import { AppProps } from 'next/app'
import { ReactElement } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ReactQueryDevtools } from 'react-query/devtools'

const queryClient = new QueryClient()

function MyApp({ Component, pageProps }: AppProps): ReactElement {
  return (
    <NhostAuthProvider auth={auth}>
      <QueryClientProvider client={queryClient}>
        <ChakraProvider resetCSS theme={customTheme}>
          <Component {...pageProps} />
        </ChakraProvider>
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </NhostAuthProvider>
  )
}

export default MyApp
