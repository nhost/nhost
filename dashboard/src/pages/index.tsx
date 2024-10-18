import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useWorkspaces } from '@/features/orgs/projects/hooks/useWorkspaces';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useRouter } from 'next/router';
import { useEffect, type ReactElement } from 'react';

export default function IndexPage() {
  const { push } = useRouter();

  const { orgs, loading: loadingOrgs } = useOrgs();
  const { workspaces, loading: loadingWorkspaces } = useWorkspaces();

  const [lastSlug] = useSSRLocalStorage('slug', null);

  useEffect(() => {
    const navigateToSlug = async () => {
      if (loadingOrgs || loadingWorkspaces) {
        return;
      }

  return (
    <div className="w-full h-full p-4 bg-accent">
      <div>Orgs Grid</div>
    </div>
  );
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout
      title="Dashboard"
      contentContainerProps={{ className: 'flex w-full flex-col' }}
    >
      <Container className="py-0">
        <MaintenanceAlert />
      </Container>

      {page}
    </AuthenticatedLayout>
  );
};
