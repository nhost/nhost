import {
  ApolloClient,
  createHttpLink,
  from,
  InMemoryCache,
  split,
  type WatchQueryFetchPolicy,
} from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';
import { RetryLink } from '@apollo/client/link/retry';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import type { NhostClient } from '@nhost/nhost-js';

import { createRestartableClient } from './ws';

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
      'Sec-WebSocket-Protocol': 'graphql-ws',
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

  const wsClient = isBrowser
    ? createRestartableClient({
        url: uri.startsWith('https')
          ? uri.replace(/^https/, 'wss')
          : uri.replace(/^http/, 'ws'),
        shouldRetry: () => true,
        retryAttempts: 100,
        retryWait: async (retries) => {
          // start with 1 second delay
          const baseDelay = 1000;

          // max 3 seconds of jitter
          const maxJitter = 3000;

          // exponential backoff with jitter

          return new Promise((resolve) => {
            setTimeout(
              resolve,
              baseDelay * 2 ** retries + Math.floor(Math.random() * maxJitter),
            );
          });
        },
        connectionParams: async () => ({
          headers: {
            ...globalHeaders,
            ...(await getAuthHeaders()),
          },
        }),
      })
    : null;

  const retryLink = new RetryLink();
  const wsLink = wsClient ? new GraphQLWsLink(wsClient) : null;

  const httpLink = setContext(async (_, { headers }) => ({
    headers: {
      ...headers,
      ...(await getAuthHeaders()),
    },
  })).concat(createHttpLink({ uri }));

  const splitLink = wsLink
    ? split(
        ({ query }) => {
          const mainDefinition = getMainDefinition(query);

          const { kind } = mainDefinition;

          return (
            kind === 'OperationDefinition' &&
            mainDefinition.operation === 'subscription'
          );
        },
        wsLink,
        httpLink,
      )
    : httpLink;

  const link = from([retryLink, splitLink]);

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

    if (!isBrowser || !wsClient?.isOpen()) {
      return;
    }

    wsClient?.restart();
  })!;

  return { client, authUnSubscribe };
};
