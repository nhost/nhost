import { getConfigServerUrl } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the local mimir when running the a local nhost project
 * @returns A function that returns a new ApolloClient instance.
 */
export default function useLocalMimirClient() {
  return useMemo(
    () =>
      new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: getConfigServerUrl(),
        }),
      }),
    [],
  );
}
