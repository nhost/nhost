import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { FilesDataGrid } from '@/features/orgs/projects/storage/dataGrid/components/FilesDataGrid';
import { NhostApolloProvider } from '@/providers/Apollo';
import { getHasuraAdminSecret } from '@/utils/env';
import type { ReactElement } from 'react';

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
      <div className="h-full max-w-full pb-25 xs+:pb-[56.5px]">
        <RetryableErrorBoundary>
          <FilesDataGrid />
        </RetryableErrorBoundary>
      </div>
    </NhostApolloProvider>
  );
}

StoragePage.getLayout = function getLayout(page: ReactElement) {
  return <OrgLayout>{page}</OrgLayout>;
};
