import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import {
  useGetOrganizationsQuery,
  type Exact,
  type GetOrganizationsQuery,
} from '@/utils/__generated__/graphql';
import { useAuthenticationStatus } from '@nhost/nextjs';
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
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading: isAuthLoading } =
    useAuthenticationStatus();
  const router = useRouter();

  const shouldFetchOrg = isPlatform && isAuthenticated && !isAuthLoading;

  const { data, loading, error, refetch } = useGetOrganizationsQuery({
    fetchPolicy: 'cache-and-network',
    skip: !shouldFetchOrg,
  });

  const orgs = data?.organizations || [];
  const currentOrgSlug = router.query.orgSlug as string | undefined;
  const currentOrg = orgs.find((org) => org.slug === currentOrgSlug);

  return {
    orgs,
    currentOrg,
    loading: data ? false : loading || isAuthLoading,
    error: error
      ? new Error(error?.message || 'Unknown error occurred.')
      : null,
    refetch,
  };
}
