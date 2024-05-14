import {
  ApolloClient,
  ApolloLink,
  createHttpLink,
  from,
  InMemoryCache,
  RequestHandler,
  split,
  WatchQueryFetchPolicy
} from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { AuthContext, NhostClient } from '@nhost/nhost-js'
import { jwtDecode, JwtPayload } from 'jwt-decode'

import { createRestartableClient } from './ws'
const isBrowser = typeof window !== 'undefined'

export type NhostApolloClientOptions = {
  nhost?: NhostClient
  graphqlUrl?: string
  headers?: any
  publicRole?: string
  fetchPolicy?: WatchQueryFetchPolicy
  connectToDevTools?: boolean
  cache?: InMemoryCache
  /**
   * @deprecated Please use `generateLinks` instead.
   */
  onError?: RequestHandler
  /**
   * @deprecated Please use `generateLinks` instead.
   */
  link?: ApolloLink
  generateLinks?: (links: (ApolloLink | RequestHandler)[]) => (ApolloLink | RequestHandler)[]
}

export const createApolloClient = ({
  nhost,
  graphqlUrl,
  headers = {},
  publicRole = 'public',
  fetchPolicy,
  cache = new InMemoryCache(),
  connectToDevTools = isBrowser && process.env.NODE_ENV === 'development',
  onError,
  link: customLink,
  generateLinks
}: NhostApolloClientOptions) => {
  const backendUrl = graphqlUrl || nhost?.graphql.httpUrl

  if (!backendUrl) {
    throw Error("Can't initialize the Apollo Client: no backend Url has been provided")
  }

  const uri = backendUrl
  const interpreter = nhost?.auth.client.interpreter

  let accessToken: AuthContext['accessToken'] | null = null

  const isJwtValid = () => {
    if (!accessToken?.value) {
      return false
    }

    const marginInSeconds = 3
    const marginInMilliseconds = marginInSeconds * 1000

    let decodedToken = jwtDecode(accessToken.value) as JwtPayload
    return decodedToken.exp! * 1000 > Date.now() - marginInMilliseconds
  }

  const isTokenValid = () =>
    !!accessToken?.value &&
    !!accessToken?.expiresAt &&
    accessToken?.expiresAt > new Date() &&
    isJwtValid()

  const isTokenValidOrNull = () => !accessToken || isTokenValid()

  const awaitValidTokenOrNull = () => {
    if (isTokenValidOrNull()) {
      return Promise.resolve()
    }

    const waitForValidToken = () => {
      if (isTokenValidOrNull()) {
        return Promise.resolve(true)
      }
      return new Promise((resolve) => {
        setTimeout(() => waitForValidToken().then(resolve), 100)
      })
    }

    return waitForValidToken()
  }

  const getAuthHeaders = async () => {
    // wait for valid access token
    await awaitValidTokenOrNull()

    // add headers
    const resHeaders = {
      ...headers,
      'Sec-WebSocket-Protocol': 'graphql-ws'
    }

    // add auth headers if signed in
    // or add 'public' role if not signed in
    if (accessToken) {
      resHeaders.authorization = `Bearer ${accessToken.value}`
    } else {
      // ? Not sure it changes anything for Hasura
      resHeaders.role = publicRole
    }

    return resHeaders
  }

  const wsClient = isBrowser
    ? createRestartableClient({
        url: uri.startsWith('https') ? uri.replace(/^https/, 'wss') : uri.replace(/^http/, 'ws'),
        shouldRetry: () => true,
        retryAttempts: 100,
        retryWait: async (retries) => {
          // start with 1 second delay
          const baseDelay = 1000

          // max 3 seconds of jitter
          const maxJitter = 3000

          // exponential backoff with jitter
          return new Promise((resolve) =>
            setTimeout(
              resolve,
              baseDelay * Math.pow(2, retries) + Math.floor(Math.random() * maxJitter)
            )
          )
        },
        connectionParams: async () => ({
          headers: {
            ...headers,
            ...(await getAuthHeaders())
          }
        })
      })
    : null

  const wsLink = wsClient ? new GraphQLWsLink(wsClient) : null

  const httpLink = setContext(async (_, { headers }) => {
    return {
      headers: {
        ...headers,
        ...(await getAuthHeaders())
      }
    }
  }).concat(createHttpLink({ uri }))

  const splitLink = wsLink
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
        httpLink
      )
    : httpLink

  const links = []

  if (onError) {
    links.push(onError)
  }

  if (customLink) {
    links.push(customLink)
  }

  links.push(splitLink)

  const link = from(generateLinks ? generateLinks(links) : links)

  const client = new ApolloClient({
    cache: cache || new InMemoryCache(),
    ssrMode: !isBrowser,
    defaultOptions: {
      watchQuery: {
        fetchPolicy
      }
    },
    connectToDevTools,
    link
  })

  interpreter?.onTransition(async (state, event) => {
    if (['SIGNOUT', 'SIGNED_IN', 'TOKEN_CHANGED'].includes(event.type)) {
      if (
        event.type === 'SIGNOUT' ||
        (event.type === 'TOKEN_CHANGED' && state.context.accessToken.value === null)
      ) {
        accessToken = null

        try {
          await client.resetStore()
        } catch (error) {
          console.error('Error resetting Apollo client cache')
          console.error(error)
        }

        return
      }

      // update token
      accessToken = state.context.accessToken

      if (!isBrowser || !wsClient?.isOpen()) {
        return
      }

      wsClient?.restart()
    }
  })

  return client
}
