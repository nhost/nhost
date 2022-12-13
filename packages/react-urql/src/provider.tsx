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
  nhost?: NhostClient
  graphqlUrl?: string
  headers?: {
    [header: string]: string
  }
  requestPolicy?: RequestPolicy
  exchanges?: Exchange[]
}

// TODO: Break out this function to a separate package: @nhost/urql
// Opinionated urql client for Nhost
function createNhostUrqlClient(options: NhostUrqlClientOptions) {
  const { nhost, headers, requestPolicy = 'cache-and-network' } = options

  if (!nhost) {
    throw Error('No `nhost` instance provided.')
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

  let exchanges: Exchange[] | undefined = [
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

    const subExchange = subscriptionExchange({
      forwardSubscription: (operation) => ({
        subscribe: (sink) => ({
          unsubscribe: wsClient.subscribe(operation, sink)
        })
      })
    })

    exchanges.push(subExchange)
  }

  const client = createUrqlClient({
    url: nhost.graphql.getUrl(),
    requestPolicy,
    exchanges,
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
