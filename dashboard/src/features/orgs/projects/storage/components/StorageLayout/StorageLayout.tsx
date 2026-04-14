import type { PropsWithChildren } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { StorageSidebar } from '@/features/orgs/projects/storage/components/StorageSidebar';
import { NhostApolloProvider } from '@/providers/Apollo';
import { getHasuraAdminSecret } from '@/utils/env';

export default function StorageLayout({ children }: PropsWithChildren) {
  const { project, loading } = useProject();

  if (!project || loading) {
    return <LoadingScreen />;
  }

  return (
    <NhostApolloProvider
      graphqlUrl={generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      )}
      fetchPolicy="cache-first"
      globalHeaders={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : project.config!.hasura.adminSecret,
      }}
    >
      <StorageSidebar />
      <div className="box flex w-full flex-auto flex-col overflow-x-hidden">
        {children}
      </div>
    </NhostApolloProvider>
  );
}
