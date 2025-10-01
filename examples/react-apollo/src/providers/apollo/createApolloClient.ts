import {
    ApolloClient,
    createHttpLink,
    from,
    InMemoryCache,
    type WatchQueryFetchPolicy,
  } from '@apollo/client/core';
  import { setContext } from '@apollo/client/link/context';
  import { RetryLink } from '@apollo/client/link/retry';
  import type { NhostClient } from '@nhost/nhost-js';
  
  
  const isBrowser = typeof window !== 'undefined';
  
  export type NhostApolloClientOptions = {
    nhost?: NhostClient;
    graphqlUrl?: string;
    globalHeaders?: any;
    fetchPolicy?: WatchQueryFetchPolicy;
    connectToDevTools?: boolean;
  };
  
  export const createApolloClient = ({
    nhost,
    graphqlUrl,
    globalHeaders = {},
    fetchPolicy,
    connectToDevTools = isBrowser && process.env.NODE_ENV === 'development',
  }: NhostApolloClientOptions) => {
    const backendUrl = graphqlUrl || nhost?.graphql.url;
  
    if (!backendUrl) {
      throw Error(
        "Can't initialize the Apollo Client: no backend Url has been provided",
      );
    }
  
    const uri = backendUrl;
  
    const getAuthHeaders = async () => {
      // add headers
      const resHeaders = {
        ...globalHeaders,
      };
  
      const session = await nhost?.refreshSession(60);
      const token = session?.accessToken;
      if (token) {
        resHeaders.authorization = `Bearer ${token}`;
      } else {
        // ? Not sure it changes anything for Hasura
        resHeaders.role = 'public';
      }
  
      return resHeaders;
    };
  
  
    const retryLink = new RetryLink();
  
    const httpLink = setContext(async (_, { headers }) => ({
      headers: {
        ...headers,
        ...(await getAuthHeaders()),
      },
    })).concat(createHttpLink({ uri }));
  
    const link = from([retryLink, httpLink]);
  
    const client = new ApolloClient({
      cache: new InMemoryCache(),
      ssrMode: !isBrowser,
      defaultOptions: {
        watchQuery: {
          fetchPolicy,
        },
      },
      connectToDevTools,
      link,
    });
  
    const authUnSubscribe = nhost?.sessionStorage.onChange(async (newSession) => {
      if (!newSession) {
        try {
          await client.resetStore();
        } catch (error) {
          console.error('Error resetting Apollo client cache');
          console.error(error);
        }
  
        return;
      }
  
    })!;
  
    return { client, authUnSubscribe };
  };
  