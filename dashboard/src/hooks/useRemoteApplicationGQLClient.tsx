import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the remote application's GraphQL endpoint
 * @returns A function that returns a new ApolloClient instance.
 */
export function useRemoteApplicationGQLClient() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const userApplicationClient = useMemo(() => {
    if (!currentApplication) {
      return new ApolloClient({ cache: new InMemoryCache() });
    }

    return new ApolloClient({
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
              ? getHasuraAdminSecret()
              : currentApplication?.config?.hasura.adminSecret,
        },
      }),
    });
  }, [currentApplication]);

  return userApplicationClient;
}

export default useRemoteApplicationGQLClient;
