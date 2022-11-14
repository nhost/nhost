import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { useAccessToken } from '@nhost/react';
import { createClient } from 'graphql-ws';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance with a split property which recognizes the type of operation and uses a different
 * link for queries/mutations (HttpLink -- our own application querying through remote schemas) and subscriptions (GraphQLWsLink connected to the bragi endpoint).
 * @returns A function that returns a new ApolloClient instance with split functionality prepared for websockets connected to bragi.
 */
export function useRemoteApplicationGQLClientWithSubscriptions() {
  const token = useAccessToken();

  const userApplicationClient = useMemo(() => {
    const httpLink = new HttpLink({
      uri: `${process.env.NEXT_PUBLIC_NHOST_BACKEND_URL}/v1/graphql`,
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    const wsLink = new GraphQLWsLink(
      createClient({
        url: process.env.NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET,
        connectionParams: {
          headers: {
            authorization: `Bearer ${token}`,
          },
        },
        webSocketImpl: WebSocket,
      }),
    );

    return new ApolloClient({
      cache: new InMemoryCache(),
      connectToDevTools: true,
      link: split(
        ({ query }) => {
          const definition = getMainDefinition(query);
          return (
            definition.kind === 'OperationDefinition' &&
            definition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink,
      ),
    });
  }, [token]);

  return userApplicationClient;
}

export default useRemoteApplicationGQLClientWithSubscriptions;
