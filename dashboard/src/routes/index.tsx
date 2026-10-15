import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { StandaloneLayout } from '@/components/layout/StandaloneLayout';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { AuthGuard } from '@/features/orgs/guards/AuthGuard';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { useAuth } from '@/providers/Auth';

export const Route = createFileRoute('/')({
  component: RouteComponent,
});

function IndexPage() {
  const { push } = useRouter();
  const navigate = useNavigate();
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
          await navigate({
            to: '/orgs/$orgSlug/projects',
            params: { orgSlug: orgFromLastSlug.slug },
          });
          return;
        }
        const org = orgs.find((o) => o.plan.isFree) || orgs[0];

        if (org) {
          navigate({
            to: '/orgs/$orgSlug/projects',
            params: { orgSlug: org.slug },
          });
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
    loadingOrgs,
    isPlatform,
    isUserLoggedIn,
    error,
    navigate,
  ]);

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex w-full max-w-md flex-col gap-8 rounded-lg border border-border p-8 text-center shadow-sm">
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

          <div className="rounded bg-muted py-2">
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
              to="/support"
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

function RouteComponent() {
  return (
    <StandaloneLayout title="Dashboard">
      <AuthGuard>
        <IndexPage />
      </AuthGuard>
    </StandaloneLayout>
  );
}
