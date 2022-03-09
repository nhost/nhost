import React from 'react'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { useNhost } from '@nhost/react'

type Options = Omit<NhostApolloClientOptions, 'interpreter' | 'backendUrl'>

export const NhostApolloProvider: React.FC<Options> = ({ children, ...options }) => {
  const nhost = useNhost()
  const { interpreter, backendUrl } = nhost.auth.client

  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const client = createApolloClient({ interpreter, backendUrl, ...options })

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}
