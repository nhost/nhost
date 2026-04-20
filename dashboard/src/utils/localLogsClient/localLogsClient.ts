import {
  ApolloClient,
  createHttpLink,
  InMemoryCache,
  split,
} from '@apollo/client';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import { getGraphqlLogsServiceUrl, getLogsWebsocketUrl } from '@/utils/env';

const httpLink = createHttpLink({ uri: getGraphqlLogsServiceUrl() });

const wsLink = new GraphQLWsLink(
  createClient({
    url: getLogsWebsocketUrl(),
    webSocketImpl: WebSocket,
  }),
);

const localLogsClient = new ApolloClient({
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

export default localLogsClient;
