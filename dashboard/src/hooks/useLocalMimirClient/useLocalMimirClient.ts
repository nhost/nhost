import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the local mimir when running the a local nhost project
 * @returns A function that returns a new ApolloClient instance.
 */
export default function useLocalMimirClient() {
  const { currentProject, loading } = useCurrentWorkspaceAndProject();

  const localMimirClient = useMemo(() => {
    const localMimirUrl =
      'https://local.dashboard.nhost.run/v1/configserver/graphql';

    if (loading) {
      return new ApolloClient({ cache: new InMemoryCache() });
    }

    return new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: localMimirUrl,
        fetchOptions: {
          mode: 'no-cors',
        },
        headers: {
          'x-hasura-admin-secret':
            process.env.NEXT_PUBLIC_ENV === 'dev'
              ? getHasuraAdminSecret()
              : currentProject?.config?.hasura.adminSecret,
        },
      }),
    });
  }, [loading, currentProject?.config?.hasura.adminSecret]);

  return localMimirClient;
}
