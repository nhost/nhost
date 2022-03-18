import React from 'react'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'

export const NhostApolloProvider: React.FC<NhostApolloClientOptions> = ({
  children,
  ...options
}) => {
  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const client = createApolloClient(options)

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}
