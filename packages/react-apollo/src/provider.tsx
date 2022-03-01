import React, { useContext } from 'react'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { NhostReactContext } from '@nhost/react'

type Props = Omit<NhostApolloClientOptions, 'backendUrl' | 'authService'>
const Wrapper: React.FC<Props> = ({ children, ...options }) => {
  const { interpreter, backendUrl } = useContext(NhostReactContext)

  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  const client = createApolloClient({ interpreter, backendUrl, ...options })

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}

export const NhostApolloProvider: React.FC<Props> = (props) => {
  // * Wrap to make sure the nhost context is fully loaded
  return <Wrapper {...props} />
}
