import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useRouter } from 'next/router';
import { useEffect, type ReactElement } from 'react';

export default function IndexPage() {
  const { push } = useRouter();
  const isPlatform = useIsPlatform();
  const { orgs, loading: loadingOrgs } = useOrgs();

  const [lastSlug] = useSSRLocalStorage('slug', null);

  useEffect(() => {
    const navigateToSlug = async () => {
      if (loadingOrgs) {
        return;
      }

      if (orgs) {
        // check if user has no organizations (first-time user)
        // should we render this even if user is not coming in for the first time?
      
        // if (orgs.length === 0 && localStorage.getItem('onboarding') === 'true') {
        if (orgs.length === 0) {
          await push('/onboarding');
          return;
        }

        const orgFromLastSlug = orgs.find((o) => o.slug === lastSlug);
        if (orgFromLastSlug) {
          await push(`/orgs/${orgFromLastSlug.slug}/projects`);
          return;
        }
        const org = orgs.find((org) => org.plan.isFree) || orgs[0];

        if (org) {
          push(`/orgs/${org.slug}/projects`);
        }
      }
    };

    if (isPlatform) {
      navigateToSlug();
    }
  }, [orgs, lastSlug, push, loadingOrgs, isPlatform]);

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
