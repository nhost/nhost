import { SiGraphql as GraphQLIcon } from '@icons-pack/react-simple-icons';
import type { ReactElement } from 'react';
import { EmptyState } from '@/components/common/EmptyState';
import { AppLayout } from '@/components/layout/AppLayout';
import { Spinner } from '@/components/ui/v3/spinner';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
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
      <EmptyState
        icon={GraphQLIcon}
        title="Remote Schemas"
        description={
          <span>Select a remote schema from the sidebar to get started.</span>
        }
      />
    );
  }

  return (
    <EmptyState
      icon={GraphQLIcon}
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
          <div className="flex h-full">
            <RemoteSchemaBrowserSidebar />
            <div className="flex w-full flex-auto flex-col overflow-x-hidden">
              {page}
            </div>
          </div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
