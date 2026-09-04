import type { ReactElement } from 'react';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { getGraphQLLayout } from '@/features/orgs/projects/graphql/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
import { RemoteSchemaDetails } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaDetails';

export default function RemoteSchemaDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  if (isPlatform && !project?.config?.hasura.adminSecret) {
    return (
      <div className="absolute inset-0 z-50 flex h-full w-full items-center justify-center">
        <Spinner className="h-5 w-5" />
      </div>
    );
  }

  return (
    <RetryableErrorBoundary>
      <RemoteSchemaDetails />
    </RetryableErrorBoundary>
  );
}

RemoteSchemaDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return getGraphQLLayout(page, {
    sidebar: <RemoteSchemaBrowserSidebar />,
    contentClassName:
      'flex w-full flex-auto flex-col overflow-x-hidden bg-background-default',
  });
};
