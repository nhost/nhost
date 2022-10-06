import React, { PropsWithChildren } from 'react'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { NhostApolloClientOptions, useApollo } from '@nhost/apollo'

// This is needed because ApolloProvider can't be rendered without a client. To be able to render
// the children without our client, we need an ApolloProvider because of potential underlying
// useQuery hooks in customer applications. This way ApolloProvider and children can be rendered.
const mockApolloClient = new ApolloClient({ cache: new InMemoryCache() })

export const NhostApolloProvider: React.FC<
  PropsWithChildren<NhostApolloClientOptions & { initialState: any }>
> = ({ children, ...options }) => {
  const client = useApollo({
    ...options,
    initialState: options.initialState,
    nhost: options.nhost
  })

  return <ApolloProvider client={client || mockApolloClient}>{children}</ApolloProvider>
}
