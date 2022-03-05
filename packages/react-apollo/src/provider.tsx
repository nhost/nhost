import React from 'react'

import { ApolloProvider } from '@apollo/client'
import { createApolloClient, NhostApolloClientOptions } from '@nhost/apollo'
import { useNhost } from '@nhost/react'

type Options = Omit<NhostApolloClientOptions, 'nhost'>

export const NhostApolloProvider: React.FC<Options> = ({ children, ...options }) => {
  const nhost = useNhost()
  // * See https://github.com/nhost/nhost/pull/214#pullrequestreview-889730478
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const client = createApolloClient({ nhost, ...options })

  if (client) return <ApolloProvider client={client}>{children}</ApolloProvider>
  else return <div>no Apollo client</div>
}
