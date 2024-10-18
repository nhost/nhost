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
    <div className="w-full h-full p-4 bg-accent">
      <div>Orgs Grid</div>
    </div>
  );
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      title="Dashboard"
      contentContainerProps={{ className: 'flex w-full flex-col' }}
    >
      <Container className="py-0">
        <MaintenanceAlert />
      </Container>

      {page}
    </ProjectLayout>
  );
};
