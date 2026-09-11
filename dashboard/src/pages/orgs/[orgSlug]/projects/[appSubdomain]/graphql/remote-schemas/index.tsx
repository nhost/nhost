import type { ReactElement } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { ContentPanel } from '@/components/layout/ContentPanel';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/layout/ProjectScope';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';
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
  return (
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <ContentPanel>
            <div className="flex h-full">
              <RemoteSchemaBrowserSidebar />
              <div className="flex w-full flex-auto flex-col overflow-x-hidden">
                {page}
              </div>
            </div>
          </ContentPanel>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
