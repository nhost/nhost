import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
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
          uri: generateAppServiceUrl(
            currentApplication?.subdomain,
            currentApplication?.region.awsName,
            'graphql',
          ),
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
      currentApplication?.region,
      currentApplication?.hasuraGraphqlAdminSecret,
    ],
  );

  return userApplicationClient;
}

export default useRemoteApplicationGQLClient;
