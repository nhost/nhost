import { useRouter } from 'next/router';
import { type ReactElement, useEffect } from 'react';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useAuth } from '@/providers/Auth';

export default function IndexPage() {
  const { push } = useRouter();
  const isPlatform = useIsPlatform();
  const { orgs, loading: loadingOrgs } = useOrgs();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  const [lastSlug] = useSSRLocalStorage('slug', null);

  useEffect(() => {
    const navigateToSlug = async () => {
      if (loadingOrgs) {
        return;
      }

      if (isUserLoggedIn && orgs) {
        if (orgs.length === 0) {
          await push('/onboarding');
          return;
        }

        const orgFromLastSlug = orgs.find((o) => o.slug === lastSlug);
        if (orgFromLastSlug) {
          await push(`/orgs/${orgFromLastSlug.slug}/projects`);
          return;
        }
        const org = orgs.find((o) => o.plan.isFree) || orgs[0];

        if (org) {
          push(`/orgs/${org.slug}/projects`);
        }
      }
    };

    if (isPlatform) {
      navigateToSlug();
    }
  }, [orgs, lastSlug, push, loadingOrgs, isPlatform, isUserLoggedIn]);

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
