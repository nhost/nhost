import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useWorkspaces } from '@/features/orgs/projects/hooks/useWorkspaces';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useRouter } from 'next/router';
import { useEffect, type ReactElement } from 'react';

export default function IndexPage() {
  const { push } = useRouter();
  const isPlatform = useIsPlatform();
  const { orgs, loading: loadingOrgs } = useOrgs();
  const { workspaces, loading: loadingWorkspaces } = useWorkspaces();

  const [lastSlug] = useSSRLocalStorage('slug', null);

  useEffect(() => {
    const navigateToSlug = async () => {
      if (loadingOrgs || loadingWorkspaces) {
        return;
      }

      if (orgs && workspaces) {
        const orgFromLastSlug = orgs.find((o) => o.slug === lastSlug);
        const workspaceFromLastSlug = workspaces.find(
          (w) => w.slug === lastSlug,
        );

        if (orgFromLastSlug) {
          await push(`/orgs/${orgFromLastSlug.slug}/projects`);
          return;
        }

        if (workspaceFromLastSlug) {
          await push(`/${workspaceFromLastSlug.slug}`);
          return;
        }

        const personalOrg = orgs.find((org) => org.plan.isFree);

        if (personalOrg) {
          push(`/orgs/${personalOrg.slug}/projects`);
        }
      }
    };

    if (isPlatform) {
      navigateToSlug();
    }
  }, [
    orgs,
    lastSlug,
    push,
    workspaces,
    loadingOrgs,
    loadingWorkspaces,
    isPlatform,
  ]);

  return <LoadingScreen />;
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <AuthenticatedLayout title="Dashboard">
      <Container className="py-0">
        <MaintenanceAlert />
      </Container>

      {page}
    </AuthenticatedLayout>
  );
};
