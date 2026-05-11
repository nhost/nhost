import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { isNotEmptyValue } from '@/lib/utils';

export default function useAdminApolloClient() {
  const { project } = useProject();

  const adminClient = useMemo(() => {
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
            'x-hasura-admin-secret': projectAdminSecret,
          },
        }),
      });
    }
    return new ApolloClient({ cache: new InMemoryCache() });
  }, [project]);

  return {
    adminClient,
  };
}
