import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import hoc from 'next-with-apollo'
import { NHOST_URL } from './nhost-url'

export const withApollo = hoc(
  ({ initialState }) => {
    // TODO set the correct apollo client with auth
    return new ApolloClient({
      uri: `${NHOST_URL}/v1/graphql`,
      cache: new InMemoryCache().restore(initialState || {})
    })
  },
  {
    render: ({ Page, props }) => {
      return (
        <ApolloProvider client={props.apollo}>
          <Page {...props} />
        </ApolloProvider>
      )
    }
  }
)
