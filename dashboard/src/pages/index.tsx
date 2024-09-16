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

  if (true) {
    return (
      <Container className="grid grid-cols-1 gap-8 md:grid-cols-4 md:pt-8">
        <Box className="noapps col-span-1 h-80 rounded-md text-center md:col-span-3">
          <div className="pt-12">
            <Text
              className="text-center text-2xl font-semibold"
              sx={{ color: 'common.white' }}
            >
              Welcome to Nhost!
            </Text>

  return <LoadingScreen />;
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
