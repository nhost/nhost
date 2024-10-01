import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

/**
 * It creates a new Apollo Client instance that connects to the remote application's GraphQL endpoint
 * @returns A function that returns a new ApolloClient instance.
 */
export default function useRemoteApplicationGQLClient() {
  const { project, loading } = useProject();
  const serviceUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'graphql',
  );

  const userApplicationClient = useMemo(() => {
    if (loading || !serviceUrl) {
      return new ApolloClient({ cache: new InMemoryCache() });
    }

    return new ApolloClient({
      cache: new InMemoryCache(),
      link: new HttpLink({
        uri: serviceUrl,
        headers: {
          'x-hasura-admin-secret':
            process.env.NEXT_PUBLIC_ENV === 'dev'
              ? getHasuraAdminSecret()
              : project?.config?.hasura.adminSecret,
        },
      }),
    });
  }, [loading, serviceUrl, project?.config?.hasura.adminSecret]);

  return userApplicationClient;
}
