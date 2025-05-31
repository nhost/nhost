import { Box } from '@/components/ui/v2/Box';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import useCreateRemoteSchemaMutation from '@/features/orgs/projects/remote-schemas/hooks/useCreateRemoteSchemaMutation/useCreateRemoteSchemaMutation';
import useGetRemoteSchemasQuery from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery/useGetRemoteSchemasQuery';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function RemoteSchemasPage() {
  const { project } = useProject();

  const {
    query: { remoteSchemaSlug },
  } = useRouter();

  const { mutate: createRemoteSchema } = useCreateRemoteSchemaMutation();

  const { data: remoteSchemas, isLoading } = useGetRemoteSchemasQuery([
    `remote_schemas`,
    project?.subdomain,
  ]);

  console.log('loading:', isLoading);

  console.log(remoteSchemas);

  const handleAddRemoteSchema = () => {
    createRemoteSchema({
      args: {
        name: 'asdf2',
        comment: 'asd2',
        definition: {
          url: 'https://sharp-glowing-muskmelon.glitch.me/',
          forward_client_headers: false,
          headers: [],
          timeout_seconds: 60,
        },
      },
    });
    console.log('add remote schema');
  };

  if (remoteSchemas && remoteSchemas.length === 0) {
    return (
      <RemoteSchemaEmptyState
        title="Remote Schema not found"
        description={<span>No remote schemas found.</span>}
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
    <ProjectLayout
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
    </ProjectLayout>
  );
};
