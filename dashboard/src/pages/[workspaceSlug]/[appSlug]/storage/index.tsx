import { LoadingScreen } from '@/components/common/LoadingScreen';
import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import FilesDataGrid from '@/components/files/FilesDataGrid';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { generateRemoteAppUrl } from '@/utils/helpers';
import { NhostApolloProvider } from '@nhost/react-apollo';
import type { ReactElement } from 'react';

export default function StoragePage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  if (!currentApplication) {
    return <LoadingScreen />;
  }

  return (
    <NhostApolloProvider
      graphqlUrl={`${generateRemoteAppUrl(
        currentApplication?.subdomain,
      )}/v1/graphql`}
      fetchPolicy="cache-first"
      headers={{
        'x-hasura-admin-secret':
          process.env.NEXT_PUBLIC_ENV === 'dev'
            ? 'nhost-admin-secret'
            : currentApplication.hasuraGraphqlAdminSecret,
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
    <ProjectLayout mainContainerProps={{ className: 'bg-gray-50' }}>
      {page}
    </ProjectLayout>
  );
};
