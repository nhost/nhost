import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { isEmptyValue } from '@/lib/utils';
import { useRouter } from 'next/router';
import { useEffect, type PropsWithChildren } from 'react';

function OrganizationGuard({ children }: PropsWithChildren) {
  const { org, loading } = useCurrentOrg();
  const router = useRouter();
  const isPlatform = useIsPlatform();

  const orgNotFound = isPlatform && isEmptyValue(org) && !loading;

  useEffect(() => {
    if (orgNotFound) {
      router.push('/404');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgNotFound]);

  return orgNotFound || loading ? null : children;
}

export default OrganizationGuard;
