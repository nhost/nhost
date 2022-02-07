import React, { useEffect } from 'react'

import { ApolloProvider } from '@apollo/client'

import { createApolloClient, NhostApolloClientOptions, token } from './apollo'
import { useAccessToken, useNhostUrl } from './react-auth'

export const NhostApolloProvider: React.FC<NhostApolloClientOptions> = ({
  children,
  ...options
}) => {
  console.log('apollo provider')
  // * Update 'Apollo' token when the 'XState' token changes
  //   const accessToken = useAccessToken()
  //   const nhostUrl = useNhostUrl()
  //   useEffect(() => {
  //     token(accessToken)
  //   }, [accessToken])
  const client = createApolloClient({ nhostUrl: 'http://127.0.0.1:1337', ...options })
  return <ApolloProvider client={client}>{children}</ApolloProvider>
}
