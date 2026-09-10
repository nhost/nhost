import { useRouter } from 'next/router';
import { type PropsWithChildren, type ReactNode, useEffect } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';

export interface OrganizationGuardProps {
  /**
   * Rendered instead of the children while the org loads. Defaults to `null`
   * because the guard fills a different slot in each layout that uses it, so
   * only the caller knows how a placeholder should be sized.
   */
  fallback?: ReactNode;
}

function OrganizationGuard({
  children,
  fallback = null,
}: PropsWithChildren<OrganizationGuardProps>) {
  const { org, loading, error } = useCurrentOrg();
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  const orgNotFound = isPlatform && isEmptyValue(org) && !loading;

  // biome-ignore lint/correctness/useExhaustiveDependencies: push does not change
  useEffect(() => {
    if (error) {
      return;
    }

    if (isUserLoggedIn && orgNotFound) {
      router.push('/404');
    }
  }, [orgNotFound, isUserLoggedIn, error]);

  if (error) {
    throw error;
  }

  return (isUserLoggedIn && orgNotFound) || loading ? fallback : children;
}

export default OrganizationGuard;
