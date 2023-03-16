import { LoadingScreen } from '@/components/common/LoadingScreen';
import MaintenanceAlert from '@/components/common/MaintenanceAlert';
import { Applications } from '@/components/home/Applications';
import Sidebar from '@/components/home/Sidebar';
import AuthenticatedLayout from '@/components/layout/AuthenticatedLayout';
import Container from '@/components/layout/Container';
import { useUserDataContext } from '@/context/workspace1-context';
import { useFetchFirstWorkspace } from '@/hooks/use-setFirstWorkspace';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import type { ReactElement } from 'react';

export default function IndexPage() {
  useFetchFirstWorkspace();

  const { loading } = useGetAllUserWorkspacesAndApplications(false);
  const { userContext } = useUserDataContext();

  if (loading && userContext.workspaces.length === 0) {
    return <LoadingScreen />;
  }

  return (
    <div className="flex w-full flex-col px-4">
      <Container className="py-0">
        <MaintenanceAlert />
      </Container>

      <Container className="flex flex-col md:flex-row">
        <Applications />
        <Sidebar />
      </Container>
    </div>
  );
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <AuthenticatedLayout title="Dashboard">{page}</AuthenticatedLayout>;
};
