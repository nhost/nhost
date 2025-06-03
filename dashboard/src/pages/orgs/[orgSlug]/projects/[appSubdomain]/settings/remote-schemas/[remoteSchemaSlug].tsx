import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Box } from '@/components/ui/v2/Box';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { RemoteSchemaBrowserSidebar } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaBrowserSidebar';
import { RemoteSchemaDetails } from '@/features/orgs/projects/remote-schemas/components/RemoteSchemaDetails';
import useGetRemoteSchemasQuery from '@/features/orgs/projects/remote-schemas/hooks/useGetRemoteSchemasQuery/useGetRemoteSchemasQuery';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';

export default function RemoteSchemaDetailsPage() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();

  const router = useRouter();

  const { remoteSchemaSlug } = router.query;

  const { data: remoteSchemas, status } = useGetRemoteSchemasQuery([
    `remote_schemas`,
    project?.subdomain,
  ]);

  const remoteSchema = remoteSchemas?.find(
    (schema) => schema.name === remoteSchemaSlug,
  );

  if (
    // isPlatform &&
    // (!project?.config?.hasura.adminSecret || status === 'loading')
    status === 'loading'
  ) {
    return <LoadingScreen />;
  }

  return (
    <RetryableErrorBoundary>
      <RemoteSchemaDetails remoteSchema={remoteSchema} />
    </RetryableErrorBoundary>
  );
}

RemoteSchemaDetailsPage.getLayout = function getLayout(page: ReactElement) {
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
