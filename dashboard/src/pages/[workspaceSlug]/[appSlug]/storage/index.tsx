import { LoadingScreen } from '@/components/common/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/common/RetryableErrorBoundary';
import { ProjectLayout } from '@/components/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { FilesDataGrid } from '@/features/storage/dataGrid/components/FilesDataGrid';
import { generateAppServiceUrl } from '@/utils/common/generateAppServiceUrl';
import { getHasuraAdminSecret } from '@/utils/env';
import { NhostApolloProvider } from '@nhost/react-apollo';
import type { ReactElement } from 'react';

export default function StoragePage() {
  const { currentProject, loading } = useCurrentWorkspaceAndProject();

  if (!currentProject || loading) {
    return <LoadingScreen />;
  }

  return (
    <NhostApolloProvider
      graphqlUrl={generateAppServiceUrl(
        currentProject.subdomain,
        currentProject.region,
        'graphql',
      )}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? getHasuraAdminSecret()
            : currentProject.config?.hasura.adminSecret,
      }}
    >
      <div className="h-full pb-25 xs+:pb-[53px]">
        <RetryableErrorBoundary>
          <FilesDataGrid />
        </RetryableErrorBoundary>
      </div>
    </NhostApolloProvider>
  );
}

StoragePage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{ sx: { backgroundColor: 'background.default' } }}
    >
      {page}
    </ProjectLayout>
  );
};
