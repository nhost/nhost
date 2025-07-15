import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { localOrganization } from '@/features/orgs/utils/local-dashboard';
import { useAuth } from '@/providers/Auth';

import {
  useGetOrganizationsQuery,
  type Exact,
  type GetOrganizationsQuery,
  type Scalars,
} from '@/utils/__generated__/graphql';
import type { ApolloQueryResult } from '@apollo/client';
import { useRouter } from 'next/router';

export type Org = GetOrganizationsQuery['organizations'][0];

export interface UseOrgsReturnType {
  orgs: Org[];
  currentOrg?: Org;
  loading?: boolean;
  error: Error | null;
  refetch: (
    variables?: Partial<
      Exact<{
        userId: Scalars['uuid'];
      }>
    >,
  ) => Promise<ApolloQueryResult<GetOrganizationsQuery>>;
}

export default function useOrgs(): UseOrgsReturnType {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { isAuthenticated, isLoading, user } = useAuth();

  const shouldFetchOrg = isPlatform && isAuthenticated && !isLoading && user;

  const { data, loading, error, refetch } = useGetOrganizationsQuery({
    variables: {
      userId: user?.id,
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
