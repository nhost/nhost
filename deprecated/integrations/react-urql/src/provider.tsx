import { createClient as createWSClient } from 'graphql-ws'
import React, { PropsWithChildren } from 'react'
import {
  cacheExchange,
  createClient as createUrqlClient,
  dedupExchange,
  Exchange,
  fetchExchange,
  Provider as UrqlProvider,
  RequestPolicy,
  subscriptionExchange
} from 'urql'
import { refocusExchange } from '@urql/exchange-refocus'
import { devtoolsExchange } from '@urql/devtools'

import type { NhostClient } from '@nhost/nhost-js'

export type NhostUrqlClientOptions = {
  /* Nhost client instance */
  nhost?: NhostClient
  /* GraphQL endpoint URL */
  graphqlUrl?: string
  /* Additional headers to send with every request */
  headers?: {
    [header: string]: string
  }
  /* Request policy. */
  requestPolicy?: RequestPolicy
  /* Custom URQL exchanges. */
  exchanges?: Exchange[]
}

// TODO: Break out this function to a separate package: @nhost/urql
// Opinionated urql client for Nhost
function createNhostUrqlClient(options: NhostUrqlClientOptions) {
  const { nhost, headers, requestPolicy = 'cache-and-network', exchanges } = options

  if (!nhost) {
    throw new Error('No `nhost` instance provided.')
  }

  if (exchanges && !Array.isArray(exchanges)) {
    throw new Error('`exchanges` must be an array.')
  }

  const getHeaders = () => {
    const resHeaders = {
      ...headers,
      'Sec-WebSocket-Protocol': 'graphql-ws'
    } as { [header: string]: string }

    const accessToken = nhost.auth.getAccessToken()

    if (accessToken) {
      resHeaders.authorization = `Bearer ${accessToken}`
    }

    return resHeaders
  }

  let urqlExchanges: Exchange[] = [
    devtoolsExchange,
    dedupExchange,
    refocusExchange(),
    cacheExchange,
    fetchExchange
  ]

  if (typeof window !== 'undefined') {
    const wsUrl = nhost.graphql.getUrl().replace('http', 'ws')

    // Close the active socket when token changes.
    // The WebSocket client will automatically reconnect with the new access token.
    let activeSocket: any
    nhost.auth.onTokenChanged(() => {
      if (!activeSocket) {
        return
      }
      activeSocket.close()
    })

    const wsClient = createWSClient({
      url: wsUrl,
      connectionParams() {
        return {
          headers: {
            ...getHeaders()
          }
        }
      },
      on: {
        connected: (socket: any) => {
          activeSocket = socket
        }
      }
    })

    urqlExchanges = [
      ...urqlExchanges,
      subscriptionExchange({
        forwardSubscription: (operation) => ({
          subscribe: (sink) => ({
            unsubscribe: wsClient.subscribe(operation, sink)
          })
        })
      })
    ]
  }

  // Allow users to override the default exchanges
  urqlExchanges = [...urqlExchanges, ...(exchanges || [])]

  const client = createUrqlClient({
    url: nhost.graphql.getUrl(),
    requestPolicy,
    exchanges: urqlExchanges,
    fetchOptions: () => {
      return {
        headers: {
          ...getHeaders()
        }
      }
    }
  })

  return client
}

export const NhostUrqlProvider: React.FC<PropsWithChildren<NhostUrqlClientOptions>> = ({
  children,
  ...options
}) => {
  const client = createNhostUrqlClient(options)

  return <UrqlProvider value={client}>{children}</UrqlProvider>
}
