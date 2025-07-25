import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

export default function useAdminApolloClient() {
  const { project, loading } = useProject();

  const adminClient = useMemo(() => {
    if (loading || !project?.subdomain) {
      return new ApolloClient({ cache: new InMemoryCache() });
    }
    const serviceUrl = generateAppServiceUrl(
      project.subdomain,
      project.region,
      'graphql',
    );

    const projectAdminSecret = project?.config?.hasura?.adminSecret!;

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
  }, [
    project?.subdomain,
    project?.config?.hasura?.adminSecret,
    project?.region,
    loading,
  ]);

  return {
    adminClient,
  };
}
