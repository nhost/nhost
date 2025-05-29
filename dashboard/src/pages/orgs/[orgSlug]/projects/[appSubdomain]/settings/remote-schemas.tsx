import { InlineCode } from '@/components/presentational/InlineCode';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { DataBrowserSidebar } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserSidebar';
import { RemoteSchemaEmptyState } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaEmptyState';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useHasuraMetadataOperation } from '@/utils/hasura-api/hooks/useHasuraMetadataOperation';
import { DataBrowserEmptyState } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserEmptyState';

export default function RemoteSchemasPage() {
  const {
    query: { dataSourceSlug },
  } = useRouter();

  const { mutate: createRemoteSchema } = useHasuraMetadataOperation();

  const handleAddRemoteSchema = () => {
    createRemoteSchema({
      data: {
        type: 'add_remote_schema',
        args: {
          name: 'asdf',
          definition: { url: '' },
        },
      },
    });
    console.log('add remote schema');
  };

  if (dataSourceSlug !== 'default') {
    return (
      <RemoteSchemaEmptyState
        title="Database not found"
        description={
          <span>
            Database{' '}
            <InlineCode className="px-1.5 text-sm">{dataSourceSlug}</InlineCode>{' '}
            does not exist.
            <Button onClick={handleAddRemoteSchema}>Add remote schema</Button>
          </span>
        }
      />
    );
  }

  return (
    <DataBrowserEmptyState
      title="Database"
      description="Select a table from the sidebar to get started."
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
      <DataBrowserSidebar className="w-full max-w-sidebar" />

      <Box
        className="flex w-full flex-auto flex-col overflow-x-hidden"
        sx={{ backgroundColor: 'background.default' }}
      >
        {page}
      </Box>
    </ProjectLayout>
  );
};
