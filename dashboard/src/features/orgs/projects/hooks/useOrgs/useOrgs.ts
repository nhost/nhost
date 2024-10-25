import { localOrganization } from '@/features/orgs/utils/local-dashboard';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetOrganizationsQuery,
  type Exact,
  type GetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus, useUserData } from '@nhost/nextjs';
import { useRouter } from 'next/router';

export type Org = GetOrganizationsQuery['organizations'][0];

export interface UseOrgsReturnType {
  orgs: Org[];
  currentOrg?: Org;
  loading?: boolean;
  error?: Error;
  refetch: (
    variables?: Partial<
      Exact<{
        [key: string]: never;
      }>
    >,
  ) => Promise<any>;
}

export default function useOrgs(): UseOrgsReturnType {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const userData = useUserData();
  const { isAuthenticated, isLoading } = useAuthenticationStatus();

  const shouldFetchOrg =
    isPlatform && isAuthenticated && !isLoading && userData;

  const { data, loading, error, refetch } = useGetOrganizationsQuery({
    variables: {
      userId: userData?.id,
    },
    fetchPolicy: 'cache-and-network',
    skip: !shouldFetchOrg,
  });

  const orgs = data?.organizations || [];
  const currentOrgSlug = router.query.orgSlug as string | undefined;
  const currentOrg = orgs.find((org) => org.slug === currentOrgSlug);

  if (isPlatform) {
    return {
      orgs,
      currentOrg,
      loading: data ? false : loading || isLoading,
      error: error
        ? new Error(error?.message || 'Unknown error occurred.')
        : null,
      refetch,
    };
  }

  return {
    orgs: [localOrganization],
    currentOrg: localOrganization,
    loading: data ? false : loading || isLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
