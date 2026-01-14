import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';
import { useRouter } from 'next/router';
import { useEffect, type PropsWithChildren } from 'react';

function OrganizationGuard({ children }: PropsWithChildren) {
  const { org, loading } = useCurrentOrg();
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  const orgNotFound = isPlatform && isEmptyValue(org) && !loading;

  // biome-ignore lint/correctness/useExhaustiveDependencies: push does not change
  useEffect(() => {
    if (isUserLoggedIn && orgNotFound) {
      router.push('/404');
    }
  }, [orgNotFound, isUserLoggedIn]);

  return (isUserLoggedIn && orgNotFound) || loading ? null : children;
}

export default OrganizationGuard;
