import React, { useEffect, useState } from 'react'

import { ApolloClient, ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'

export const NhostApolloProvider: React.FC<
  NhostApolloClientOptions & { children?: React.ReactNode }
> = ({ children, ...options }) => {
  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const [client, setClient] = useState<ApolloClient<unknown>>()
  useEffect(() => {
    if (!client) {
      setClient(createApolloClient(options))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return null
}
