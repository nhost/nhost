import hoc from 'next-with-apollo'

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client'

// TODO set the correct apollo client with auth
export const withApollo = hoc(
  ({ initialState, ...rest }: any) => {
    console.log('rest', Object.keys(rest))
    return new ApolloClient({
      uri: `http://127.0.0.1:1337/v1/graphql`,
      cache: new InMemoryCache().restore(initialState || {})
    })
  },
  {
    render: ({ Page, props }) => {
      console.log('props.session', props.session)
      return (
        <ApolloProvider client={props.apollo}>
          <Page {...props} />
        </ApolloProvider>
      )
    }
  }
)
