import { ApolloClient, InMemoryCache, ApolloProvider } from '@apollo/client'
import hoc, { ApolloAppContext, ApolloPageContext } from 'next-with-apollo'

export interface NhostPageContext<C = any> extends ApolloPageContext {
  additionalData: string
}
export interface NhostAppContext<C = any> extends ApolloAppContext {
  ctx: NhostPageContext<C>
  AppTree: any
}
export declare type NhostContext<C = any> = NhostPageContext<C> | NhostAppContext<C>

export const withApollo = hoc(
  ({ initialState }) => {
    // TODO set the correct apollo client with auth
    return new ApolloClient({
      uri: 'http://127.0.0.1:1337/v1/graphql',
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
