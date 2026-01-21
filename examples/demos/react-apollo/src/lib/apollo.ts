import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { type NhostClient } from '@nhost/nhost-js';

// Load Apollo Client error messages in development
if (import.meta.env.DEV) {
  import('@apollo/client/dev').then(({ loadDevMessages, loadErrorMessages }) => {
    loadDevMessages();
    loadErrorMessages();
  });
}

export const createApolloClient = (nhost: NhostClient) => {
  const httpLink = createHttpLink({
    uri: nhost.graphql.url,
  });

  const authLink = setContext((_, { headers }) => {
    // Get the authentication token from Nhost
    const token = nhost.getUserSession()?.accessToken;
    
    return {
      headers: {
        ...headers,
        ...(token && { authorization: `Bearer ${token}` }),
      }
    };
  });

  return new ApolloClient({
    link: authLink.concat(httpLink),
    cache: new InMemoryCache(),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'all',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
};
