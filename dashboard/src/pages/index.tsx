import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import {
  useGetAllWorkspacesAndProjectsQuery,
  useGetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { useUserData } from '@nhost/nextjs';
import { type ReactElement } from 'react';

export default function IndexPage() {
  const user = useUserData();

  const { loading: loadingOrgs } = useGetOrganizationsQuery({
    skip: !user,
  });

  const { loading: loadingWorkspaces } = useGetAllWorkspacesAndProjectsQuery({
    fetchPolicy: 'cache-and-network',
  });

  if (!user || loadingOrgs || loadingWorkspaces) {
    return <LoadingScreen />;
  }

  return (
    <Container className="grid grid-cols-1 gap-8 md:grid-cols-4">
      <div>Orgs Grid</div>
    </Container>
  );
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      title="Dashboard"
      contentContainerProps={{ className: 'flex w-full flex-col px-4' }}
    >
      <Container className="py-0">
        <MaintenanceAlert />
      </Container>

      {page}
    </ProjectLayout>
  );
};
