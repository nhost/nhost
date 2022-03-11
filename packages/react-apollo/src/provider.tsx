import React from 'react'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { NhostClient } from '@nhost/react'

type Options = { nhost: NhostClient } & Omit<NhostApolloClientOptions, 'interpreter' | 'backendUrl'>

export const NhostApolloProvider: React.FC<Options> = ({ children, nhost, ...options }) => {
  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const client = createApolloClient({
    interpreter: nhost.auth.client.interpreter,
    backendUrl: nhost.graphql.getUrl(),
    ...options
  })

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}
