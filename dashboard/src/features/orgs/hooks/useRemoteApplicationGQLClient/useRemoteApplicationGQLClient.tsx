import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';
import { getHasuraAdminSecret } from '@/utils/env';

/**
 * It creates a new Apollo Client instance that connects to the remote application's GraphQL endpoint
 * @returns A function that returns a new ApolloClient instance.
 */
export default function useRemoteApplicationGQLClient() {
  const { project } = useProject();

  const userApplicationClient = useMemo(() => {
    if (isNotEmptyValue(project)) {
      const serviceUrl = generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      );
      const projectAdminSecret = project.config!.hasura.adminSecret;

      return new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
          uri: serviceUrl,
          headers: {
            'x-hasura-admin-secret':
              process.env.NEXT_PUBLIC_ENV === 'dev'
                ? getHasuraAdminSecret()
                : projectAdminSecret,
          },
        }),
      });
    }
    return new ApolloClient({ cache: new InMemoryCache() });
  }, [project]);

  return userApplicationClient;
}
