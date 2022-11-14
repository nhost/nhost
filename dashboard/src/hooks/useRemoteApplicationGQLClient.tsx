import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { generateRemoteAppUrl } from '@/utils/helpers';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the remote application's GraphQL endpoint
 * @returns A function that returns a new ApolloClient instance.
 */
export function useRemoteApplicationGQLClient() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const userApplicationClient = useMemo(
    () =>
      new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: `${generateRemoteAppUrl(
            currentApplication?.subdomain,
          )}/v1/graphql`,
          headers: {
            'x-hasura-admin-secret':
              process.env.NEXT_PUBLIC_ENV === 'dev'
                ? 'nhost-admin-secret'
                : currentApplication?.hasuraGraphqlAdminSecret,
          },
        }),
      }),
    [
      currentApplication?.subdomain,
      currentApplication?.hasuraGraphqlAdminSecret,
    ],
  );

  return userApplicationClient;
}

export default useRemoteApplicationGQLClient;
