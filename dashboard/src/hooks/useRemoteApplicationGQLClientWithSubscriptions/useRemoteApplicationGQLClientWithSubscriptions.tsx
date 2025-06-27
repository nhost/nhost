import { useNhostClient } from '@/providers/nhost';
import { nhost as test } from '@/utils/nhost';
import {
  ApolloClient,
  createHttpLink,
  InMemoryCache,
  split,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { useMemo } from 'react';

const getAuthHeaders = async () => {
  // add headers
  const session = await test?.refreshSession(60);
  const token = session?.accessToken;
  const resHeaders: any = {
    'Sec-WebSocket-Protocol': 'graphql-ws',
  };

  if (token) {
    resHeaders.authorization = `Bearer ${token}`;
  }

  return resHeaders;
};

/**
 * It creates a new Apollo Client instance with a split property which recognizes the type of operation and uses a different
 * link for queries/mutations (HttpLink -- our own application querying through remote schemas) and subscriptions (GraphQLWsLink connected to the bragi endpoint).
 * @returns A function that returns a new ApolloClient instance with split functionality prepared for websockets connected to bragi.
 */
export default function useRemoteApplicationGQLClientWithSubscriptions() {
  const nhost = useNhostClient();

  const userApplicationClient = useMemo(() => {
    const uri = nhost.graphql.url;
    const httpLink = setContext(async (_, { headers }) => ({
      headers: {
        ...headers,
        ...(await getAuthHeaders()),
      },
    })).concat(createHttpLink({ uri }));

    const wsLink = new GraphQLWsLink(
      createClient({
        url: process.env.NEXT_PUBLIC_NHOST_BRAGI_WEBSOCKET,
        connectionParams: async () => ({
          headers: await getAuthHeaders(),
        }),
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
  }, [nhost.graphql]);

  return userApplicationClient;
}
