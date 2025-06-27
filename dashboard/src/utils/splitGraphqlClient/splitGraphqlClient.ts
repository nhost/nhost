import { nhost } from '@/utils/nhost';
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

const getAuthHeaders = async () => {
  // add headers
  const session = await nhost.refreshSession(60);
  const token = session?.accessToken;
  const resHeaders: any = {
    'Sec-WebSocket-Protocol': 'graphql-ws',
  };

  if (token) {
    resHeaders.authorization = `Bearer ${token}`;
  }

  return resHeaders;
};

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

const splitQraphqlClient = new ApolloClient({
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

export default splitQraphqlClient;
