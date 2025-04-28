import { AppShell, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { NhostClient, NhostProvider } from '@nhost/nextjs'
import { NhostApolloProvider } from '@nhost/react-apollo'
import { inspect } from '@xstate/inspect'
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <NhostProvider nhost={nhost}>
      <NhostApolloProvider nhost={nhost}>
        <MantineProvider withGlobalClasses defaultColorScheme="light">
          <Notifications />
          <AppShell
            padding="md"
          // navbar={<NavBar />}
          // header={
          //   <Header height={60} p="xs">
          //     {title}
          //   </Header>
          // }
          >
            {children}
          </AppShell>
        </MantineProvider>
      </NhostApolloProvider>
    </NhostProvider>
  )
}
