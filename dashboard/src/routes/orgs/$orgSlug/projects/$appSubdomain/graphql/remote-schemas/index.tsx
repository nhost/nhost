import { createFileRoute } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/v3/spinner';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import { useGetRemoteSchemas } from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemas';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/graphql/remote-schemas/',
)({
  component: RemoteSchemasPage,
});

function RemoteSchemasPage() {
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
