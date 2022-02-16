import hoc from 'next-with-apollo'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'

export const withApollo = hoc(
  ({ initialState }) => {
    // TODO set the correct apollo client with auth
    return new ApolloClient({
      uri: `http://127.0.0.1:1337/v1/graphql`,
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
