import { useNavigate } from '@tanstack/react-router';
import { type PropsWithChildren, useEffect } from 'react';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';
import { useAuth } from '@/providers/Auth';

function OrganizationGuard({ children }: PropsWithChildren) {
  const { org, loading, error } = useCurrentOrg();
  const navigate = useNavigate();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading, isSigningOut } = useAuth();

  const isUserLoggedIn = isAuthenticated && !isLoading && !isSigningOut;

  const orgNotFound = isPlatform && isEmptyValue(org) && !loading;

  useEffect(() => {
    if (error) {
      return;
    }

    if (isUserLoggedIn && orgNotFound) {
      navigate({ to: '/404' });
    }
  }, [orgNotFound, isUserLoggedIn, error, navigate]);

  if (error) {
    throw error;
  }

  return (isUserLoggedIn && orgNotFound) || loading ? null : children;
}

export default OrganizationGuard;
