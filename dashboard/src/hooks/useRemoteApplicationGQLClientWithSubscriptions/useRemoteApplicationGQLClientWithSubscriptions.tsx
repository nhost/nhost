import { ApolloClient, HttpLink, InMemoryCache, split } from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { useAccessToken, useNhostClient } from '@nhost/nextjs';
import { createClient } from 'graphql-ws';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance with a split property which recognizes the type of operation and uses a different
 * link for queries/mutations (HttpLink -- our own application querying through remote schemas) and subscriptions (GraphQLWsLink connected to the bragi endpoint).
 * @returns A function that returns a new ApolloClient instance with split functionality prepared for websockets connected to bragi.
 */
export default function useRemoteApplicationGQLClientWithSubscriptions() {
  const client = useNhostClient();
  const token = useAccessToken();

  const userApplicationClient = useMemo(() => {
    const httpLink = new HttpLink({
      uri: client.graphql.getUrl(),
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
      cache: new InMemoryCache({
        typePolicies: {
          Subscription: {
            fields: {
              logs: {
                keyArgs: false,
              },
            },
          },
          Query: {
            fields: {
              logs: {
                keyArgs: false,
              },
            },
          },
        },
      }),
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
  }, [client.graphql, token]);

  return userApplicationClient;
}
