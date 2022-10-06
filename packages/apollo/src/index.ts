import merge from 'deepmerge'
import isEqual from 'lodash/isEqual'
import * as React from 'react'

import {
  ApolloClient,
  ApolloClientOptions,
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
import { NhostClient } from '@nhost/nhost-js'

import { createRestartableClient } from './ws'

const isBrowser = typeof window !== 'undefined'

export type NhostCreateApolloClientOptions = {
  nhost?: NhostClient
  graphqlUrl?: string
  headers?: any
  publicRole?: string
  fetchPolicy?: WatchQueryFetchPolicy
  connectToDevTools?: boolean
  cache?: InMemoryCache
  onError?: RequestHandler
}

export type NhostApolloClientOptions = NhostCreateApolloClientOptions & {
  initialState?: any
}

export const createApolloClient = (options: NhostCreateApolloClientOptions): ApolloClient<any> => {
  const { cache, connectToDevTools, fetchPolicy, graphqlUrl, headers, nhost, onError, publicRole } =
    options
  let backendUrl = graphqlUrl || nhost?.graphql.getUrl()

  if (!backendUrl) {
    throw Error("Can't initialize the Apollo Client: no backend Url has been provided")
  }
  const interpreter = nhost?.auth.client.interpreter

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

  const uri = backendUrl

  const wsClient =
    isBrowser &&
    createRestartableClient({
      url: uri.startsWith('https') ? uri.replace(/^https/, 'wss') : uri.replace(/^http/, 'ws'),
      connectionParams: () => ({
        headers: {
          ...headers,
          ...getAuthHeaders()
        }
      })
    })
  const wsLink = wsClient && new GraphQLWsLink(wsClient)

  const httpLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        ...getAuthHeaders()
      }
    }
  }).concat(
    createHttpLink({
      uri
    })
  )

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
        httpLink
      )
    : httpLink

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

  interpreter?.onTransition(async (state: any, event: any) => {
    if (['SIGNOUT', 'SIGNED_IN', 'TOKEN_CHANGED'].includes(event.type)) {
      const newToken = state.context.accessToken.value
      token = newToken
      if (event.type === 'SIGNOUT') {
        try {
          await client.resetStore()
        } catch (error) {
          console.error('Error resetting Apollo client cache')
          console.error(error)
        }
      } else {
        if (isBrowser && wsClient && wsClient.started()) {
          wsClient.restart()
        }
      }
    }
  })

  return client
}

export const APOLLO_STATE_PROP_NAME = '__APOLLO_STATE__'

let apolloClient: ApolloClient<any>
export function initializeApollo(options: NhostApolloClientOptions) {
  const { initialState } = options
  const _apolloClient = apolloClient ?? createApolloClient({ ...options })

  if (initialState) {
    const existingCache = _apolloClient.extract()

    const data = merge(existingCache, initialState, {
      arrayMerge: (destinationArray, sourceArray) => [
        ...sourceArray,
        ...destinationArray.filter((d) => sourceArray.every((s) => !isEqual(d, s)))
      ]
    })

    _apolloClient.cache.restore(data)
  }

  if (typeof window === 'undefined') return _apolloClient
  if (!apolloClient) apolloClient = _apolloClient

  return _apolloClient
}

export function addApolloState(client: ApolloClient<any>, pageProps: any) {
  if (pageProps?.props) {
    pageProps.props[APOLLO_STATE_PROP_NAME] = client.cache.extract()
  }

  return pageProps
}

export function useApollo(options: NhostApolloClientOptions) {
  const { initialState } = options
  const state = initialState[APOLLO_STATE_PROP_NAME]
  const store = React.useMemo(
    () => initializeApollo({ ...options, initialState: state }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state]
  )
  return store
}
