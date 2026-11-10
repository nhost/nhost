import { useRouter } from 'next/router';
import { type PropsWithChildren, useEffect } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAuth } from '@/providers/Auth';

/**
 * Renders its children only for visitors who are not signed in. A signed-in
 * visitor is sent to where they were headed before sign-in (the `redirect`
 * query param or the stored target), falling back to the dashboard root.
 */
export default function GuestGuard({ children }: PropsWithChildren) {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isPlatform && (isLoading || !isAuthenticated)) {
      return;
    }

    const redirectQuery =
      typeof router.query.redirect === 'string' &&
      router.query.redirect.startsWith('/')
        ? router.query.redirect
        : null;
    const storedRedirect = sessionStorage.getItem('postSignInRedirect');
    const redirectTarget =
      redirectQuery ||
      (storedRedirect?.startsWith('/') ? storedRedirect : null) ||
      '/';

    if (storedRedirect) {
      sessionStorage.removeItem('postSignInRedirect');
    }

    router.push(redirectTarget);
  }, [isLoading, isAuthenticated, router, isPlatform]);

  if (!isPlatform || isLoading || isAuthenticated) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return children;
}
