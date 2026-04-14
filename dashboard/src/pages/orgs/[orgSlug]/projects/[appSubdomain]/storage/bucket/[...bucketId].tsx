import type { ReactElement } from 'react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { Bucket } from '@/features/orgs/projects/storage/components/Bucket';
import { StorageSidebar } from '@/features/orgs/projects/storage/components/StorageSidebar';
import { NhostApolloProvider } from '@/providers/Apollo';
import { getHasuraAdminSecret } from '@/utils/env';

export default function StoragePage() {
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
        <div className="h-full max-w-full pb-25 xs+:pb-[56.5px]">
          <RetryableErrorBoundary>
            <Bucket />
          </RetryableErrorBoundary>
        </div>
      </div>
    </NhostApolloProvider>
  );
}

StoragePage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      {page}
    </OrgLayout>
  );
};
