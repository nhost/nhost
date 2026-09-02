import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { getGraphQLLayout } from '@/features/orgs/projects/graphql/layout';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';

export default function RemoteSchemasPage() {
  const { data: remoteSchemas, isLoading } = useGetRemoteSchemas();

  if (isLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading remote schemas...
      </Spinner>
    );
  }

  if (remoteSchemas && remoteSchemas.length === 0) {
    return (
      <RemoteSchemaEmptyState
        title="Remote Schemas"
        description={
          <span>Select a remote schema from the sidebar to get started.</span>
        }
      />
    );
  }

  return (
    <RemoteSchemaEmptyState
      title="Remote Schemas"
      description="Select a remote schema from the sidebar to get started."
    />
  );
}

RemoteSchemasPage.getLayout = function getLayout(page: ReactElement) {
  return getGraphQLLayout(page, {
    sidebar: <RemoteSchemaBrowserSidebar />,
    contentClassName:
      'flex w-full flex-auto flex-col overflow-x-hidden bg-background-default',
  });
};
