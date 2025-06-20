import {
  memo,
  type PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from 'react';

import { ApolloProvider } from '@apollo/client';
import {
  createApolloClient,
  type NhostApolloClientOptions,
} from './createApolloClient';

function NhostApolloProvider({
  children,
  nhost,
  graphqlUrl,
  globalHeaders,
  fetchPolicy,
  connectToDevTools,
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

  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}

export default memo(NhostApolloProvider);
