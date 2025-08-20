import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';
import type { ReactElement } from 'react';

export default function RemoteSchemasPage() {
  const { data: remoteSchemas, isLoading } = useGetRemoteSchemas();

  if (isLoading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading remote schemas..."
        className="justify-center"
      />
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
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <RemoteSchemaBrowserSidebar className="w-full max-w-sidebar" />

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </OrgLayout>
  );
};
