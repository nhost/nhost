import React, { PropsWithChildren, useEffect, useState } from 'react'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'

// This is needed because ApolloProvider can't be rendered without a client. To be able to render
// the children without our client, we need an ApolloProvider because of potential underlying
// useQuery hooks in customer applications. This way ApolloProvider and children can be rendered.
const mockApolloClient = new ApolloClient({ cache: new InMemoryCache() })

export const NhostApolloProvider: React.FC<PropsWithChildren<NhostApolloClientOptions>> = ({
  children,
  ...options
}) => {
  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const [client, setClient] = useState<ReturnType<typeof createApolloClient>>()

  // Note: Because we're using XState under the hood, we need to make sure to start the interpreter
  // on the client side when the component is mounted. This is why we're using `useState` and
  // `useEffect`.
  useEffect(() => {
    if (!client) {
      setClient(createApolloClient(options))
    }
  }, [client, options])

  return <ApolloProvider client={client || mockApolloClient}>{children}</ApolloProvider>
}
