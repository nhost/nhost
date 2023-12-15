import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { ApolloClient, HttpLink, InMemoryCache } from '@apollo/client';

export default function useAdminApolloClient() {
  const { currentProject } = useCurrentWorkspaceAndProject();

  const serviceUrl = generateAppServiceUrl(
    currentProject?.subdomain,
    currentProject?.region,
    'graphql',
  );

  const adminClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: serviceUrl,
      headers: {
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : currentProject?.config?.hasura.adminSecret,
      },
    }),
  });

  return {
    adminClient,
  };
}
