import {
  memo,
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApolloClient, ApolloProvider, InMemoryCache } from '@apollo/client';
import {
  createApolloClient,
  type NhostApolloClientOptions,
} from './createApolloClient';

// This is needed because ApolloProvider can't be rendered without a client. To be able to render
// the children without our client, we need an ApolloProvider because of potential underlying
// useQuery hooks in customer applications. This way ApolloProvider and children can be rendered.
const mockApolloClient = new ApolloClient({ cache: new InMemoryCache() });

function NhostApolloProvider({
  children,
  nhost,
  graphqlUrl,
  globalHeaders,
  fetchPolicy,
  connectToDevTools,
  generateLinks,
}: PropsWithChildren<NhostApolloClientOptions>) {
  const authUnSubscribeRef = useRef<() => void>();
  const [client] = useState<ReturnType<typeof createApolloClient>['client']>(
    () => {
      const { client: apolloClient, authUnSubscribe } = createApolloClient({
        nhost,
        graphqlUrl,
        globalHeaders,
        fetchPolicy,
        connectToDevTools,
        generateLinks,
      });
      authUnSubscribeRef.current = authUnSubscribe;
      return apolloClient;
    },
  );

  useEffect(
    () => () => {
      authUnSubscribeRef.current?.();
    },
    [],
  );

  return (
    <ApolloProvider client={client || mockApolloClient}>
      {children}
    </ApolloProvider>
  );
}

export default memo(NhostApolloProvider);
