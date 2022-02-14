import { gql } from '@apollo/client'
import { ApolloClient, InMemoryCache } from '@apollo/client'

let CLIENT: ApolloClient<unknown>

const isServer = typeof window === 'undefined'

const windowApolloState = !isServer && (window.__NEXT_DATA__ as any).apolloState

export function getApolloClient(forceNew = false) {
  if (!CLIENT || forceNew) {
    console.log('new client')
    CLIENT = new ApolloClient({
      ssrMode: isServer,
      uri: 'http://127.0.0.1:1337/v1/graphql',
      cache: new InMemoryCache().restore(windowApolloState || {})

      // // Default options to disable SSR for all queries.
      // defaultOptions: {
      //   // Skip queries when server side rendering
      //   // https://www.apollographql.com/docs/react/data/queries/#ssr
      //   watchQuery: {
      //     ssr: false
      //   },
      //   query: {
      //     ssr: false
      //   }
      //   // Selectively enable specific queries like so:
      //   // `useQuery(QUERY, { ssr: true });`
      // }
    })
  }

  return CLIENT
}

export const QUERY = gql`
  query MyQuery {
    test {
      id
    }
  }
`

export const QUERY_INDEX = gql`
  query MyQuery {
    test {
      id
      bidon
    }
  }
`
