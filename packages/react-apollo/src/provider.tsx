import React, { useContext, useEffect, useState } from 'react'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { NhostReactContext } from '@nhost/react'

type Props = Omit<NhostApolloClientOptions, 'backendUrl' | 'authService'>
const Wrapper: React.FC<Props> = ({ children, ...options }) => {
  const nhostContext = useContext(NhostReactContext)

  const [client, setClient] = useState<ApolloClient<InMemoryCache>>()

  useEffect(() => {
    setClient(createApolloClient({ ...nhostContext, ...options }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}

export const NhostApolloProvider: React.FC<Props> = (props) => {
  // * Wrap to make sure the nhost context is fully loaded
  return <Wrapper {...props} />
}
