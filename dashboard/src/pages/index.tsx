import { TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useState } from 'react';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';
import { Container } from '@/components/layout/Container';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { MaintenanceAlert } from '@/components/presentational/MaintenanceAlert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useAuth } from '@/providers/Auth';

export default function IndexPage() {
  const { push } = useRouter();
  const isPlatform = useIsPlatform();
  const { orgs, loading: loadingOrgs, error, refetch } = useOrgs();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;
  const [isRetrying, setIsRetrying] = useState(false);

  const [lastSlug] = useSSRLocalStorage('slug', null);

  useEffect(() => {
    const navigateToSlug = async () => {
      if (loadingOrgs) {
        return;
      }

      // Don't redirect to onboarding when we failed to fetch organizations.
      // The empty orgs array is due to a fetch error, not because the user
      // has no organizations.
      if (error) {
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
  }, [orgs, lastSlug, push, loadingOrgs, isPlatform, isUserLoggedIn, error]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-md flex-col gap-8 rounded-lg border border-border bg-card p-8 text-center shadow-sm">
          <TriangleAlert className="mx-auto size-10 text-amber-500" />
          <div className="flex flex-col gap-4">
            <h3 className="font-semibold text-lg">
              An unexpected error occurred
            </h3>
            <div>
              <p className="text-muted-foreground">
                Please try again in a few minutes.
              </p>
              <p className="text-muted-foreground">
                This is usually temporary.
              </p>
            </div>
          </div>

          <div className="rounded bg-[#f4f7f9] py-2 dark:bg-[#21262d]">
            <CodeBlock
              copyToClipboardToastTitle="Error details"
              className="!mt-0 rounded text-sm"
            >
              {error.message}
            </CodeBlock>
          </div>

          <ButtonWithLoading
            loading={isRetrying}
            onClick={async () => {
              setIsRetrying(true);
              try {
                await refetch();
              } finally {
                setIsRetrying(false);
              }
            }}
          >
            Try Again
          </ButtonWithLoading>
          <p className="text-muted-foreground text-sm">
            If this issue persists, please{' '}
            <Link
              href="/support"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold underline underline-offset-2"
            >
              contact support
            </Link>
          </p>
        </div>
      </div>
    );
  }

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
