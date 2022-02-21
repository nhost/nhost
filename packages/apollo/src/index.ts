import { SubscriptionClient } from 'subscriptions-transport-ws'
import type { InterpreterFrom } from 'xstate'

import {
  ApolloClient,
  ApolloClientOptions,
  createHttpLink,
  from,
  InMemoryCache,
  RequestHandler,
  split,
  WatchQueryFetchPolicy
} from '@apollo/client'
import { setContext } from '@apollo/client/link/context'
import { WebSocketLink } from '@apollo/client/link/ws'
import { getMainDefinition } from '@apollo/client/utilities'
import { NhostMachine } from '@nhost/client'
const isBrowser = typeof window !== 'undefined'

export type NhostApolloClientOptions = {
  interpreter?: InterpreterFrom<NhostMachine>
  backendUrl: string
  headers?: any
  publicRole?: string
  fetchPolicy?: WatchQueryFetchPolicy
  connectToDevTools?: boolean
  cache?: InMemoryCache
  onError?: RequestHandler
}

export const createApolloClient = ({
  interpreter,
  backendUrl,
  headers = {},
  publicRole = 'public',
  fetchPolicy,
  cache = new InMemoryCache(),
  connectToDevTools = isBrowser && process.env.NODE_ENV === 'development',
  onError
}: NhostApolloClientOptions) => {
  if (!interpreter) {
    throw Error("Nhost has not be initiated! Apollo client can't be created")
  }
  let token: string | null = null

  const getAuthHeaders = () => {
    // add headers
    const resHeaders = {
      ...headers,
      'Sec-WebSocket-Protocol': 'graphql-ws'
    }

    // add auth headers if signed in
    // or add 'public' role if not signed in
    if (token) {
      resHeaders.authorization = `Bearer ${token}`
    } else {
      // ? Not sure it changes anything for Hasura
      resHeaders.role = publicRole
    }

    return resHeaders
  }

  const uri = `${backendUrl}/v1/graphql`
  // if (graphqlUrl) {
  //   uri = graphqlUrl
  // } else if (backendUrl) {
  //   uri = `${backendUrl}/v1/graphql`
  // } else {
  //   throw new Error('no GraphQL URL')
  // }

  const wsUri = uri.startsWith('https') ? uri.replace(/^https/, 'wss') : uri.replace(/^http/, 'ws')

  let webSocketClient: SubscriptionClient | null = null
  if (isBrowser) {
    webSocketClient = new SubscriptionClient(wsUri, {
      lazy: true,
      reconnect: true,
      connectionParams: () => ({
        headers: getAuthHeaders()
      })
    })
  }

  const httplink = createHttpLink({
    uri
  })

  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        ...getAuthHeaders()
      }
    }
  })

  const link = webSocketClient
    ? split(
        ({ query }) => {
          const mainDefinition = getMainDefinition(query)

          const { kind } = mainDefinition
          let operation
          if ('operation' in mainDefinition) {
            operation = mainDefinition.operation
          }

          return kind === 'OperationDefinition' && operation === 'subscription'
        },
        new WebSocketLink(webSocketClient),
        authLink.concat(httplink)
      )
    : authLink.concat(httplink)

  const apolloClientOptions: ApolloClientOptions<any> = {
    cache: cache || new InMemoryCache(),
    ssrMode: !isBrowser,
    defaultOptions: {
      watchQuery: {
        fetchPolicy
      }
    },
    connectToDevTools
  }

  // add link
  apolloClientOptions.link = typeof onError === 'function' ? from([onError, link]) : from([link])

  const client = new ApolloClient(apolloClientOptions)

  interpreter?.onTransition(async (state, event) => {
    const newToken = state.context.accessToken.value

    if (token !== newToken) {
      token = newToken
      client.reFetchObservableQueries()
      if (isBrowser && webSocketClient) {
        if (newToken) {
          if (webSocketClient.status === 1) {
            // @ts-expect-error
            webSocketClient.tryReconnect()
          }
        } else {
          if (webSocketClient.status === 1) {
            // must close first to avoid race conditions
            webSocketClient.close()
            // reconnect
            // @ts-expect-error
            webSocketClient.tryReconnect()
          }
          if (event.type === 'SIGNOUT') {
            await client.resetStore().catch((error) => {
              console.error('Error resetting Apollo client cache')
              console.error(error)
            })
          }
        }
      }
    }
  })

  return client
}
