import { AppShell, Header, MantineProvider } from '@mantine/core'
import { NotificationsProvider } from '@mantine/notifications'
import { NhostClient, NhostProvider } from '@nhost/nextjs'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'
import type { AppProps } from 'next/app'
import Head from 'next/head'
import NavBar from '../components/NavBar'
import '../styles/globals.css?inline'

const devTools = typeof window !== 'undefined' && !!process.env.NEXT_PUBLIC_DEBUG
if (devTools) {
  inspect({
    url: 'https://stately.ai/viz?inspect',
    iframe: false
  })
}
const nhost = new NhostClient({ subdomain: 'local', devTools })
const title = 'Nhost with NextJs'
function MyApp({ Component, pageProps }: AppProps) {
  // * Monorepo-related. See: https://stackoverflow.com/questions/71843247/react-nextjs-type-error-component-cannot-be-used-as-a-jsx-component
  // const AnyComponent = Component as any
  return (
    <NhostProvider nhost={nhost} initial={pageProps.nhostSession}>
      <NhostApolloProvider nhost={nhost}>
        <Head>
          <title>{title}</title>
          <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
        </Head>

        <MantineProvider
          withGlobalStyles
          withNormalizeCSS
          theme={{
            /** Put your mantine theme override here */
            colorScheme: 'light'
          }}
        >
          <NotificationsProvider>
            <AppShell
              padding="md"
              navbar={<NavBar />}
              header={
                <Header height={60} p="xs">
                  {title}
                </Header>
              }
              styles={(theme) => ({
                main: {
                  backgroundColor:
                    theme.colorScheme === 'dark' ? theme.colors.dark[8] : theme.colors.gray[0]
                }
              })}
            >
              <Component {...pageProps} />
            </AppShell>
          </NotificationsProvider>
        </MantineProvider>
      </NhostApolloProvider>
    </NhostProvider>
  )
}

export default MyApp
