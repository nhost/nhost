import React, { useContext, useEffect, useState } from 'react'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { NhostContext } from '@nhost/react'

export const NhostApolloProvider: React.FC<
  Omit<NhostApolloClientOptions, 'backendUrl' | 'authService'>
> = ({ children, ...options }) => {
  const nhostContext = useContext(NhostContext)

  const [client, setClient] = useState<ApolloClient<InMemoryCache>>()

  useEffect(() => {
    setClient(createApolloClient({ ...nhostContext, ...options }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}
