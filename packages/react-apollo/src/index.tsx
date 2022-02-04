/* eslint-disable no-console */
/* eslint-disable unicorn/prefer-spread */
/* eslint-disable prefer-destructuring */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ReactNode, useState } from 'react'
import { SubscriptionClient } from 'subscriptions-transport-ws'
import {
  ApolloClient,
  ApolloClientOptions,
  ApolloProvider,
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
import { NhostClient } from '@nhost/nhost-js'

const isBrowser = () => typeof window !== 'undefined'

interface GenerateApolloClientOptions {
  nhost?: NhostClient
  graphqlUrl?: string
  headers: any
  publicRole: string
  fetchPolicy: WatchQueryFetchPolicy | undefined
  connectToDevTools: boolean
  cache: InMemoryCache
  onError?: RequestHandler
}

function generateApolloClient({
  nhost,
  graphqlUrl,
  headers,
  publicRole,
  fetchPolicy,
  cache,
  connectToDevTools,
  onError
}: GenerateApolloClientOptions) {
  const getAuthHeaders = () => {
    // add headers
    const resHeaders = {
      ...headers,
      'Sec-WebSocket-Protocol': 'graphql-ws'
    }

    // if graphqlUrl is being used, don't use `nhost`
    if (graphqlUrl) {
      return resHeaders
    }

    // add auth headers if signed in
    // or add 'public' role if not signed in
    if (nhost?.auth.isAuthenticated()) {
      resHeaders.authorization = `Bearer ${nhost.auth.getAccessToken()}`
    } else {
      resHeaders.role = publicRole
    }

    return resHeaders
  }

  let uri = ''
  if (graphqlUrl) {
    uri = graphqlUrl
  } else if (nhost) {
    uri = nhost.graphql.getUrl()
  } else {
    throw new Error('no GraphQL URL')
  }

  const wsUri = uri.startsWith('https') ? uri.replace(/^https/, 'wss') : uri.replace(/^http/, 'ws')

  let webSocketClient: SubscriptionClient | undefined
  if (isBrowser()) {
    webSocketClient = new SubscriptionClient(wsUri, {
      lazy: true,
      reconnect: true,
      connectionParams: () => ({
        headers: getAuthHeaders()
      })
    })
  }

  // if webSocketClient is set, we're in the browser.
  const wsLink = webSocketClient ? new WebSocketLink(webSocketClient) : null

  const httplink = createHttpLink({
    uri
  })

  const authLink = setContext((_, previousContext) => ({
    headers: {
      ...getAuthHeaders(),
      ...previousContext?.headers
    }
  }))

  const link = wsLink
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
        wsLink,
        authLink.concat(httplink)
      )
    : httplink

  const apolloClientOptions: ApolloClientOptions<any> = {
    cache: cache || new InMemoryCache(),
    ssrMode: !isBrowser(),
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

  return { client, webSocketClient }
}

interface NhostApolloProviderProps {
  nhost?: NhostClient
  graphqlUrl?: string
  children: ReactNode
  headers?: any
  publicRole?: string
  fetchPolicy?: WatchQueryFetchPolicy | undefined
  connectToDevTools?: boolean
  cache?: InMemoryCache
  onError?: RequestHandler
}

export function NhostApolloProvider({
  nhost,
  graphqlUrl,
  children,
  headers = {},
  publicRole = 'public',
  fetchPolicy,
  cache = new InMemoryCache(),
  connectToDevTools = false,
  onError
}: NhostApolloProviderProps) {
  const [constructorHasRun, setConstructorHasRun] = useState(false)
  const [apolloClient, setApolloClient] = useState<ApolloClient<any> | null>(null)

  const constructor = () => {
    if (constructorHasRun) return

    const { client, webSocketClient } = generateApolloClient({
      graphqlUrl,
      nhost,
      headers,
      publicRole,
      fetchPolicy,
      cache,
      connectToDevTools,
      onError
    })

    // if graphqlUrl is being used, don't use `nhost`
    // instead, early exit.
    if (graphqlUrl) {
      setApolloClient(client)
      setConstructorHasRun(true)
      return
    }

    if (nhost && webSocketClient) {
      nhost.auth.onTokenChanged(() => {
        if (webSocketClient.status === 1) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          webSocketClient.tryReconnect()
        }
      })

      // restart websocket link when
      nhost.auth.onAuthStateChanged(async (event, _session) => {
        // reconnect ws connection with new auth headers for the logged in/out user
        if (webSocketClient.status === 1) {
          // must close first to avoid race conditions
          webSocketClient.close()
          // reconnect
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error
          webSocketClient.tryReconnect()
        }
        if (event === 'SIGNED_OUT') {
          await client.resetStore().catch((error) => {
            console.error('Error resetting Apollo client cache')
            console.error(error)
          })
        }
      })
    }

    setApolloClient(client)
    setConstructorHasRun(true)
  }

  constructor()

  // maybe skip if !inBrowser()?
  if (!apolloClient) {
    return <div>Apollo Client not yet available</div>
  }

  // if (!isBrowser()) {
  //   return <div>no</div>;
  // }

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}
