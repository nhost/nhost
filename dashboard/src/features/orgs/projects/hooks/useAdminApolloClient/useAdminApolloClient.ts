import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';
import { useMemo } from 'react';

export default function useAdminApolloClient() {
  const { project } = useProject();

  const serviceUrl = generateAppServiceUrl(
    project?.subdomain,
    project?.region,
    'graphql',
  );

  const projectAdminSecret = project?.config?.hasura?.adminSecret;

  const adminClient = useMemo(
    () =>
      new ApolloClient({
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
      }),
    [serviceUrl, projectAdminSecret],
  );

  return {
    adminClient,
  };
}
